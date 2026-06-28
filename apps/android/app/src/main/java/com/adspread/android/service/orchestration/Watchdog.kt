package com.adspread.android.service.orchestration

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 播放看门狗（spec §7.1 / §10，A6）：独立检测编排心跳，无心跳 >30s 触发软重启。
 *
 * **心跳源**：[ProgressReporter] 每 10s tick 调 [feed]（编排协程存活证明）。自上次喂狗起经过
 * ≥ [timeoutMs] 未再喂狗，判定编排卡死，触发 [onTimeout]（[PlayerService] 装配为 [PlayerController.rebuild]）。
 *
 * **纯协程时序**：仅用 [delay] 驱动检查周期，以检查计数推算经过时长，不依赖 `TimeProvider`/墙钟——
 * 便于单测用虚拟时间驱动（`advanceTimeBy`），且不受系统时间漂移影响（spec §10 时间漂移仅影响 playDays 判定）。
 *
 * **触发去重**：触发后置 [triggered]，后续检查不再重复触发，直到下次 [feed] 复位（避免 rebuild 期间重复触发）。
 *
 * **线程安全**：[feed]（ProgressReporter 协程）与检查（本看门狗协程）均在 [PlayerService] 同一 scope
 * （主线程）上运行，单线程无竞争；[Volatile] 保证挂起/恢复跨恢复点的可见性。
 *
 * **V1 检测范围**：捕获编排协程级卡死（ProgressReporter 停止 tick）。ExoPlayer 解码器级冻结
 * （协程存活但无帧渲染）超出 V1 检测能力，列后续（需 `onVideoFrameRendered` 回调）。
 */
@Singleton
class Watchdog @Inject constructor() {

    @Volatile private var triggered = false
    @Volatile private var checkCount = 0
    @Volatile private var lastFeedCheck = 0

    /** 喂狗：记录当前检查 epoch 为最近心跳，复位触发标志。 */
    fun feed() {
        lastFeedCheck = checkCount
        triggered = false
    }

    /**
     * 启动看门狗轮询。
     *
     * @param timeoutMs 无心跳超时阈值（spec §7.1 = 30s）
     * @param checkIntervalMs 轮询间隔（默认 timeoutMs/3，30s 即 10s；检测延迟 ≤ checkIntervalMs）
     * @param onTimeout 超时回调（软重启编排）
     */
    fun start(
        scope: CoroutineScope,
        timeoutMs: Long = TIMEOUT_MS,
        checkIntervalMs: Long = (timeoutMs / 3).coerceAtLeast(1L),
        onTimeout: () -> Unit,
    ): Job {
        feed()  // 启动即喂一次，避免首检误触发
        return scope.launch {
            while (isActive) {
                delay(checkIntervalMs)
                checkCount++
                if (triggered) continue
                val elapsedSinceFeed = (checkCount - lastFeedCheck) * checkIntervalMs
                if (elapsedSinceFeed >= timeoutMs) {
                    triggered = true
                    onTimeout()
                }
            }
        }
    }

    private companion object {
        /** 30s 超时（spec §7.1：播放线程无心跳 >30s 触发软重启）。 */
        const val TIMEOUT_MS = 30_000L
    }
}
