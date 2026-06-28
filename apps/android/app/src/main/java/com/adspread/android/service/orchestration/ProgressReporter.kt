package com.adspread.android.service.orchestration

import com.adspread.android.data.local.db.dao.PlayLogDao
import com.adspread.android.data.local.db.entity.PlayLogEntity
import com.adspread.android.domain.playback.RegionPlaybackState
import com.adspread.android.domain.schedule.TimeProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 播放进度上报循环（spec §7.1，A6）：协程 10s tick → 写 `play_log` 缓冲（由 LogRepository 上报）。
 *
 * 每 tick 为各在播 region 写一条 `progress` 行（materialId/regionId/programId/startedAt/已播时长）。
 * 离线时 `play_log` 10000 行 LRU 兜底（spec §4.1），LogRepository 网络恢复后按 acceptedIds 删除。
 *
 * **看门狗心跳源**：每 tick 调 [onTick]（由 [PlayerService] 装配为 [Watchdog.feed]）——
 * ProgressReporter 持续 tick 即编排协程存活；停止 tick >30s 触发 [Watchdog] 软重启（spec §7.1）。
 *
 * @param stateProvider 由 [PlayerService] 装配，返回 [PlayerController.state] 当前值
 * @param sessionId 本次 PlayerService 运行标识（PlayLogEntity.sessionId），由 Service 生成 UUID
 */
@Singleton
class ProgressReporter @Inject constructor(
    private val playLogDao: PlayLogDao,
    private val timeProvider: TimeProvider,
) {

    fun start(
        scope: CoroutineScope,
        intervalMs: Long = INTERVAL_MS,
        sessionId: String,
        stateProvider: () -> Map<String, RegionPlaybackState>,
        onTick: () -> Unit = {},
    ): Job = scope.launch {
        while (isActive) {
            val now = timeProvider.now().toEpochMilli()
            val state = stateProvider()
            for (rs in state.values) {
                writeProgress(rs, sessionId, now)
            }
            onTick()  // 喂看门狗
            delay(intervalMs)
        }
    }

    private suspend fun writeProgress(rs: RegionPlaybackState, sessionId: String, now: Long) {
        val materialId = rs.currentMaterialId ?: return
        playLogDao.insert(
            PlayLogEntity(
                sessionId = sessionId,
                materialId = materialId,
                regionId = rs.regionId,
                programId = rs.programId,
                startedAt = rs.startedAtMs,
                endedAt = null,  // 进行中，无结束时刻
                durationMs = (now - rs.startedAtMs).coerceAtLeast(0L),
                eventType = "progress",
                synced = 0,
                createdAt = now,
            ),
        )
    }

    private companion object {
        /** 10s tick（spec §7.1）。 */
        const val INTERVAL_MS = 10_000L
    }
}
