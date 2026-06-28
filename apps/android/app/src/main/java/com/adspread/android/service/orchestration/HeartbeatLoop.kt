package com.adspread.android.service.orchestration

import com.adspread.android.data.remote.dto.HeartbeatReq
import com.adspread.android.data.repository.DeviceRepository
import com.adspread.android.domain.playback.RegionPlaybackState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 设备心跳循环（spec §7.1 / K7，A6）：协程 60s tick → [DeviceRepository.heartbeat]。
 *
 * 对齐 dashboard 在线阈值 5min（60s × 5 次未到即判离线），避免后端写压力。失败由
 * [DeviceRepository] 内部入 `event_log` 缓冲，不中断循环。
 *
 * **未绑定跳过**：[DeviceRepository.heartbeat] 未绑定返回 false（不发请求），循环继续。
 *
 * @param requestProvider 由 [PlayerService] 装配，从 [PlayerController.state] 构造 [HeartbeatReq]；
 *   解耦 HeartbeatLoop 与 PlayerController，便于单测注入固定请求。
 */
@Singleton
class HeartbeatLoop @Inject constructor(
    private val deviceRepository: DeviceRepository,
) {

    /**
     * 启动心跳循环。首次立即发送（设备尽快上报在线），之后每 [intervalMs] 一次。
     *
     * @return 循环 Job，供调用方取消
     */
    fun start(
        scope: CoroutineScope,
        intervalMs: Long = INTERVAL_MS,
        requestProvider: () -> HeartbeatReq,
    ): Job = scope.launch {
        while (isActive) {
            val req = requestProvider()
            deviceRepository.heartbeat(req)
            delay(intervalMs)
        }
    }

    private companion object {
        /** 60s tick（spec §7.1 / K7，对齐 dashboard 5min 在线阈值）。 */
        const val INTERVAL_MS = 60_000L
    }
}

/**
 * 由当前各 region 播放状态构造 [HeartbeatReq]（纯函数，便于单测）。
 *
 * - status：有 region 在播 → "playing"；无 → "idle"
 * - currentProgramId：取首个 region 的 programId（同节目所有 region 一致）
 * - regionStates：各 region 的 materialId/type/decodeTier/currentIndex 摘要（V1 后端仅校验不落库）
 */
fun buildHeartbeatReq(state: Map<String, RegionPlaybackState>): HeartbeatReq {
    val status = if (state.isEmpty()) "idle" else "playing"
    val programId = state.values.firstOrNull()?.programId
    val regionStates: List<JsonObject> = state.values.map { rs ->
        buildJsonObject {
            put("regionId", rs.regionId)
            put("materialId", rs.currentMaterialId)
            put("materialType", rs.materialType?.name)
            put("decodeTier", rs.decodeTier?.name)
            put("currentIndex", rs.currentIndex)
        }
    }
    return HeartbeatReq(
        status = status,
        currentProgramId = programId,
        regionStates = regionStates,
    )
}
