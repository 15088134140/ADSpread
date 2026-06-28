package com.adspread.android.service.orchestration

import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.adspread.android.data.local.cache.MaterialStore
import com.adspread.android.data.local.prefs.DeviceConfigStore
import com.adspread.android.data.repository.ProgramRepository
import com.adspread.android.data.repository.SyncRepository
import com.adspread.android.domain.model.DeviceIdentity
import com.adspread.android.domain.model.MaterialRef
import com.adspread.android.domain.model.MaterialType
import com.adspread.android.domain.model.Program
import com.adspread.android.domain.model.Region
import com.adspread.android.domain.playback.DecodeTier
import com.adspread.android.domain.playback.PlaybackOrchestrator
import com.adspread.android.domain.playback.Playlist
import android.util.Log
import com.adspread.android.domain.playback.PlaylistItem
import com.adspread.android.domain.playback.RegionPlaybackState
import com.adspread.android.domain.playback.VideoDecodePolicy
import com.adspread.android.domain.schedule.LocalScheduleEngine
import com.adspread.android.domain.schedule.TimeProvider
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.isActive
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 播放编排器实现（spec §7.1 / ADR-E，A6）。
 *
 * 实现 [PlaybackOrchestrator]（domain 端口）+ 持有 ExoPlayer 实例池（K3）+ 暴露
 * [state] 供 UI（A10）订阅各 region 当前播放状态。
 *
 * **职责**：
 * 1. 消费 [LocalScheduleEngine] 输出（programId）+ [SyncRepository.programChanged] 信号，解析当前应播节目；
 * 2. 按 region 构建 [Playlist]（视频/图片统一），视频 region 创建常驻 ExoPlayer（[DecoderPool] 按硬解上限降级，K3），
 *    图片 region 由协程定时轮播；
 * 3. 驱动 region 切换（视频 `STATE_ENDED` / 图片 `durationMs` 到期），LOOP 循环；
 * 4. 通过 [state]（`StateFlow<Map<regionId, RegionPlaybackState>>`）暴露当前各 region 播放状态供 A10 订阅。
 *
 * **Surface 绑定**（A10）：A10 调 [playerForRegion] 取视频 region 的 ExoPlayer 绑定 `SurfaceView`；
 * A6 不写 Compose UI。视频 MediaItem 由本类装载，A10 仅绑 Surface。
 *
 * **MediaSession**：[sessionPlayerForMediaSession] 暴露一个空闲 ExoPlayer 供 [PlayerService] 构建
 * mediaPlayback 类型所需的最小 MediaSession（ADR-B）。
 *
 * **线程约束**：ExoPlayer 调用必须在主线程（Looper）。本类在 [Dispatchers.Main] 上跑编排协程；
 * Room suspend 查询内部自行切换 IO，不阻塞主线程。所有可变状态（[regionPlayers] 等）仅在主线程访问。
 *
 * **soft restart**：[rebuild] 释放 region 级 ExoPlayer（保留 sessionPlayer + scope）后重解析节目，
 * 供 [Watchdog] 超时触发（spec §7.1）。
 */
@Singleton
class PlayerController @Inject constructor(
    private val decoderPool: DecoderPool,
    private val programRepository: ProgramRepository,
    private val syncRepository: SyncRepository,
    private val scheduleEngine: LocalScheduleEngine,
    private val deviceConfigStore: DeviceConfigStore,
    private val materialStore: MaterialStore,
    private val timeProvider: TimeProvider,
    private val serverConfigStore: com.adspread.android.data.local.prefs.ServerConfigStore,
) : PlaybackOrchestrator {

    private val _state = MutableStateFlow<Map<String, RegionPlaybackState>>(emptyMap())
    val state: StateFlow<Map<String, RegionPlaybackState>> = _state.asStateFlow()

    // region 级状态（仅主线程访问）
    private val regionPlayers = mutableMapOf<String, ExoPlayer>()
    private val regionJobs = mutableMapOf<String, Job>()
    private val regionPlaylists = mutableMapOf<String, Playlist>()
    private val regionIndices = mutableMapOf<String, Int>()
    private val regionTiers = mutableMapOf<String, DecodeTier>()
    private var currentProgramId: Int? = null

    private var scope: CoroutineScope? = null
    private var sessionPlayer: ExoPlayer? = null
    private var scheduleJob: Job? = null
    private var changedJob: Job? = null
    private val resolveMutex = Mutex()

    /** 供 [PlayerService] 构建 MediaSession 的空闲 ExoPlayer（mediaPlayback 类型所需，ADR-B）。 */
    val sessionPlayerForMediaSession: ExoPlayer? get() = sessionPlayer

    /** 供 A10 绑定 Surface 的视频 region ExoPlayer；图片 region 返回 null。 */
    fun playerForRegion(regionId: String): ExoPlayer? = regionPlayers[regionId]

    /**
     * 启动编排：创建 sessionPlayer + 首次解析 + 60s 调度 tick + programChanged 监听。
     *
     * 幂等：重复调用以最后一个 scope 为准（生产仅 [PlayerService.onStartCommand] 调一次）。
     */
    fun start(scope: CoroutineScope) {
        this.scope = scope
        // sessionPlayer 必须在主线程创建（ExoPlayer 绑定 Looper）；start 由 Service 主线程调用
        sessionPlayer = decoderPool.createPlayer(DecodeTier.HARDWARE)
        scope.launch(Dispatchers.Main) { resolveAndPlay() }
        scheduleJob = scope.launch(Dispatchers.Main) {
            while (isActive) {
                delay(SCHEDULE_TICK_MS)
                resolveAndPlay()
            }
        }
        changedJob = scope.launch(Dispatchers.Main) {
            syncRepository.programChanged.collect { resolveAndPlay() }
        }
    }

    /** 停止编排：取消所有协程 + 释放全部 ExoPlayer（region + session）+ 清状态。 */
    fun stop() {
        scheduleJob?.cancel()
        changedJob?.cancel()
        releaseRegions()
        sessionPlayer?.let { runCatching { it.release() } }
        sessionPlayer = null
        currentProgramId = null
        _state.value = emptyMap()
        scope = null
    }

    /**
     * 软重启（spec §7.1 / Watchdog 触发）：释放 region 级 ExoPlayer（保留 sessionPlayer + scope）后重解析节目。
     *
     * 用于播放线程无心跳超时后的恢复；不做进程级重启（进程级自愈属 A9 CrashHandler）。
     */
    fun rebuild() {
        val s = scope ?: return
        releaseRegions()
        currentProgramId = null
        s.launch(Dispatchers.Main) { resolveAndPlay() }
    }

    /**
     * 解析当前应播节目并重建各 region 播放（internal 便于单测直接驱动，绕过 start 的 tick 循环）。
     *
     * 同一 programId 不重建（避免 tick 抖动中断播放）；programId 变化或首次解析才 [setupRegions]。
     * [resolveMutex] 串行化 schedule tick 与 programChanged 的并发触发。
     */
    internal suspend fun resolveAndPlay() {
        resolveMutex.withLock {
            val storeId = deviceConfigStore.storeId()
            // device.id 占位 0：本地调度仅用 storeId（LocalScheduleEngine）；设备数字 id 在 JWT sub，V1 不解码
            val device = DeviceIdentity(
                id = 0,
                code = deviceConfigStore.deviceCode() ?: "",
                storeId = storeId,
            )
            val plans = programRepository.getPublishPlans()
            Log.d(TAG, "resolveAndPlay: plans=${plans.size}, storeId=$storeId, code=${device.code}")
            val programId = scheduleEngine.resolveCurrentProgramId(plans, device)
            if (programId == null) {
                Log.d(TAG, "resolveAndPlay: no matching program")
                if (currentProgramId != null) {
                    releaseRegions()
                    currentProgramId = null
                    _state.value = emptyMap()
                }
                return
            }
            if (programId == currentProgramId) return  // 未变，不打断播放
            val program = programRepository.getProgram(programId) ?: return
            val readyMaterials = programRepository.getReadyMaterials().associateBy { it.id }
            currentProgramId = programId
            Log.d(TAG, "resolveAndPlay: program=$programId, regions=${program.regions.size}, materials=${readyMaterials.size}")
            setupRegions(program, readyMaterials)
        }
    }

    /** 按 program 的 regions 构建播放：视频 region 建 ExoPlayer，图片 region 启轮播定时器。 */
    private suspend fun setupRegions(program: Program, materials: Map<Int, MaterialRef>) {
        releaseRegions()

        val videoRegionIds = mutableListOf<String>()
        val pendingState = mutableMapOf<String, RegionPlaybackState>()

        for (region in program.regions) {
            val playlist = buildPlaylist(region, materials)
            if (playlist.items.isEmpty()) continue  // L5：无就绪素材，跳过该 region
            regionPlaylists[region.regionId] = playlist
            regionIndices[region.regionId] = 0
            val firstItem = playlist.items.first()
            val startedAt = timeProvider.now().toEpochMilli()
            if (firstItem.material.type == MaterialType.VIDEO) {
                videoRegionIds.add(region.regionId)
            } else {
                startImageTimer(region.regionId)
            }
            pendingState[region.regionId] = buildState(
                region.regionId, program.id, 0, firstItem, playlist.items.size,
                decodeTier = null, startedAt = startedAt,
            )
        }

        // 视频解码层级决策（K3）：硬解上限内主区域硬解，溢出软解
        val tiers = VideoDecodePolicy.planDecodeTiers(
            decoderPool.maxHardwareVideoDecoders(), videoRegionIds,
        )
        for (regionId in videoRegionIds) {
            val tier = tiers[regionId] ?: DecodeTier.HARDWARE
            regionTiers[regionId] = tier
            val playlist = regionPlaylists[regionId] ?: continue
            val item = playlist.items.first()
            val path = materialStore.pathFor(item.materialId).absolutePath
            val player = createAndStartPlayer(regionId, tier, path)
            regionPlayers[regionId] = player
            pendingState[regionId] = buildState(
                regionId, program.id, 0, item, playlist.items.size,
                decodeTier = tier, startedAt = timeProvider.now().toEpochMilli(),
            )
        }
        _state.value = pendingState
    }

    /**
     * 推进指定 region 到下一个素材（LOOP 循环）。视频由 `Player.STATE_ENDED` 触发，
     * 图片由 [startImageTimer] 定时器触发；单测可直接调用验证推进逻辑。
     */
    internal fun advanceRegion(regionId: String) {
        val playlist = regionPlaylists[regionId] ?: return
        val oldIndex = regionIndices[regionId] ?: return
        val newIndex = if (oldIndex + 1 < playlist.items.size) oldIndex + 1 else 0
        regionIndices[regionId] = newIndex
        val item = playlist.items[newIndex]
        val startedAt = timeProvider.now().toEpochMilli()
        val programId = currentProgramId ?: return
        if (item.material.type == MaterialType.VIDEO) {
            val path = materialStore.pathFor(item.materialId).absolutePath
            val player = regionPlayers[regionId]
            if (player != null) {
                player.setMediaItem(MediaItem.fromUri(Uri.fromFile(java.io.File(path))))
                player.prepare()
                player.play()
            }
        }
        val tier = if (item.material.type == MaterialType.VIDEO) regionTiers[regionId] else null
        _state.update { current ->
            current.toMutableMap().apply {
                this[regionId] = buildState(
                    regionId, programId, newIndex, item, playlist.items.size,
                    decodeTier = tier, startedAt = startedAt,
                )
            }
        }
    }

    /** 图片 region 轮播定时器：按当前项 [PlaylistItem.durationMs] 延时后推进，LOOP。 */
    private fun startImageTimer(regionId: String) {
        val s = scope ?: return
        regionJobs[regionId] = s.launch(Dispatchers.Main) {
            try {
                while (isActive) {
                    val playlist = regionPlaylists[regionId] ?: break
                    val index = regionIndices[regionId] ?: break
                    val duration = playlist.items[index].durationMs()
                    if (duration <= 0L) break
                    delay(duration)
                    if (!isActive) break
                    advanceRegion(regionId)
                }
            } catch (_: CancellationException) {
                // 取消即退出（region 重建/stop）
            }
        }
    }

    private suspend fun createAndStartPlayer(
        regionId: String,
        tier: DecodeTier,
        localPath: String,
    ): ExoPlayer = withContext(Dispatchers.Main) {
        val player = decoderPool.createPlayer(tier)
        player.setMediaItem(MediaItem.fromUri(Uri.fromFile(java.io.File(localPath))))
        player.prepare()
        player.play()
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                    advanceRegion(regionId)
                }
            }
        })
        player
    }

    /** PlaybackOrchestrator 实现：按 region 的 MaterialItem + 就绪素材元数据构建 Playlist（L5 过滤未就绪）。 */
    override fun buildPlaylist(region: Region, materials: Map<Int, MaterialRef>): Playlist {
        val items = region.materials.mapNotNull { item ->
            val ref = materials[item.materialId] ?: return@mapNotNull null  // L5：未就绪/损坏素材跳过
            PlaylistItem(materialId = item.materialId, durationSec = item.durationSec, material = ref)
        }
        return Playlist(items)
    }

    private fun buildState(
        regionId: String,
        programId: Int,
        index: Int,
        item: com.adspread.android.domain.playback.PlaylistItem,
        playlistSize: Int,
        decodeTier: DecodeTier?,
        startedAt: Long,
    ): RegionPlaybackState = RegionPlaybackState(
        regionId = regionId,
        programId = programId,
        currentIndex = index,
        currentMaterialId = item.materialId,
        currentMaterialLocalPath = materialStore.pathFor(item.materialId).absolutePath,
        remoteFileUrl = serverConfigStore.hostForStatic() + item.material.fileUrl,
        materialType = item.material.type,
        playlistSize = playlistSize,
        decodeTier = decodeTier,
        startedAtMs = startedAt,
    )

    private fun releaseRegions() {
        regionJobs.values.forEach { it.cancel() }
        regionJobs.clear()
        regionPlayers.values.forEach { runCatching { it.release() } }
        regionPlayers.clear()
        regionPlaylists.clear()
        regionIndices.clear()
        regionTiers.clear()
    }

    private companion object {
        const val TAG = "PlayerController"
        /** 调度重解析 tick（spec §5.2 每 60s，捕获 endTime/playDays 时间性变更）。 */
        const val SCHEDULE_TICK_MS = 60_000L
    }
}
