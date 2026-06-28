package com.adspread.android.service.orchestration

import android.app.Activity
import com.adspread.android.app.MainActivity
import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.data.remote.socket.IncomingSocketEvent
import com.adspread.android.data.remote.socket.SocketIoClient
import com.adspread.android.domain.command.Command
import com.adspread.android.domain.command.CommandResult
import com.adspread.android.domain.command.CommandRouter
import com.adspread.android.service.orchestration.handler.CommandHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * [CommandRouter] 实现（spec §6.2 / §7.1，A8）。
 *
 * **职责**：
 * 1. 通过 [startCollecting] 订阅 [SocketIoClient.incomingEvents]，消费 `command:*` 事件；
 * 2. 按 [Command] 查找对应的 [CommandHandler] 分发执行；
 * 3. `supported=false` 的指令（RESTART_DEVICE / POWER_SCHEDULE）直接返回 UNSUPPORTED ack；
 * 4. `command:screenshot` 在 handler 执行后调用 [ScreenshotCapture] 捕获画面并将 URL 附入 ack；
 * 5. 通过 [SocketIoClient.sendAck] 回传执行结果。
 *
 * **线程模型**：事件收集在调用方协程（PlayerService 主线程 scope），handler 在主线程执行。
 * 耗时 handler（如 FetchLogsHandler 的 logcat 调用）内部自行切 [Dispatchers.IO]。
 *
 * **异常安全**：handler 抛出任何异常被 catch 转为 [CommandResult.FAILED]，
 * 确保 ack 始终有回传。
 */
@Singleton
class CommandRouterImpl @Inject constructor(
    private val socketIoClient: SocketIoClient,
    private val screenshotCapture: ScreenshotCapture,
    /** 由 DI 注入的 handler map（按 Command 索引，仅含 supported=true 的指令）。 */
    private val handlerMap: Map<Command, @JvmSuppressWildcards CommandHandler>,
    private val syncRepository: com.adspread.android.data.repository.SyncRepository,
) : CommandRouter {

    private var collectingJob: Job? = null

    /**
     * 开始订阅 [SocketIoClient.incomingEvents] 并处理指令 + ad:update。
     *
     * 由 [PlayerService][com.adspread.android.service.PlayerService] 在 onStartCommand 中调用。
     * 幂等：重复调用先取消旧的 collection 再重建（生产仅调一次）。
     */
    fun startCollecting(scope: CoroutineScope) {
        collectingJob?.cancel()
        // 确保 Socket.io 已连接（首次绑定后连接，重连由 socket.io-client 内置机制处理）
        socketIoClient.connect()
        collectingJob = scope.launch {
            socketIoClient.incomingEvents.collect { event ->
                when (event) {
                    is IncomingSocketEvent.AdUpdate -> {
                        // ad:update → 立即全量同步（spec §6.2）
                        launch {
                            try { syncRepository.sync() } catch (_: Exception) {}
                        }
                    }
                    is IncomingSocketEvent.CommandEvent -> {
                        routeAndAck(event)
                    }
                }
            }
        }
    }

    /** 停止事件收集。由 PlayerService onDestroy 调用。 */
    fun stopCollecting() {
        collectingJob?.cancel()
        collectingJob = null
    }

    /**
     * 路由指令到对应 handler 并回传 ack。
     *
     * 流程：
     * 1. `supported=false` → UNSUPPORTED ack 立即返回；
     * 2. 查询 handlerMap → 找不到返回 FAILED；
     * 3. 调用 handler.execute(payload) → 异常捕获转为 FAILED；
     * 4. SCREENSHOT 指令且在 handler 成功后 → 调用 screenshotCapture.capture() 获取截图路径；
     * 5. ack 回传。
     */
    private fun routeAndAck(event: IncomingSocketEvent.CommandEvent) {
        // 1. supported=false 指令
        if (!event.command.supported) {
            socketIoClient.sendAck(
                commandId = event.commandId,
                result = CommandResult.UNSUPPORTED,
            )
            return
        }

        // 2. 查找 handler
        val handler = handlerMap[event.command]
        if (handler == null) {
            socketIoClient.sendAck(
                commandId = event.commandId,
                result = CommandResult.FAILED,
                error = "No handler registered for ${event.command}",
            )
            return
        }

        // 3. 执行 handler
        val result = try {
            handler.execute(event.payload)
        } catch (e: Exception) {
            CommandResult.FAILED
        }

        // 4. screenshot 特殊处理
        val screenshotUrl = if (event.command == Command.SCREENSHOT && result == CommandResult.SUCCESS) {
            try {
                // 对于截图，尝试取 Activity（通过当前顶层 Activity；V1 若 Activity 不可达则返回 null）
                captureScreenshotForAck()
            } catch (e: Exception) {
                null
            }
        } else null

        // 5. ack
        socketIoClient.sendAck(
            commandId = event.commandId,
            result = result,
            error = if (result == CommandResult.FAILED) "Handler execution failed" else null,
            screenshotUrl = screenshotUrl,
        )
    }

    /**
     * 尝试获取当前 Activity 并截屏。
     * V1 中通过 Activity 的全局引用获取（由 MainActivity 在生命周期中维护）；若不可达返回 null。
     */
    private fun captureScreenshotForAck(): String? {
        val activity = ActivityRefProvider.currentActivity
        return screenshotCapture.capture(activity)
    }

    // ===== CommandRouter 端口实现 =====

    /**
     * 同步分发指令（端口方法）。
     *
     * 此方法仅用于单元测试或非事件驱动的场景；
     * 生产路径走 [startCollecting] → [routeAndAck]。
     * 无 payload 上下文时使用 [CommandPayload.Empty] 调用 handler。
     */
    override fun dispatch(command: Command): CommandResult {
        if (!command.supported) return CommandResult.UNSUPPORTED
        val handler = handlerMap[command] ?: return CommandResult.FAILED
        return try {
            handler.execute(CommandPayload.Empty)
        } catch (e: Exception) {
            CommandResult.FAILED
        }
    }
}

/**
 * Activity 引用提供器（线程安全）。
 *
 * 由 [MainActivity][com.adspread.android.app.MainActivity] 在 `onCreate` / `onDestroy`
 * 中维护引用，供 [CommandRouterImpl] 截图时获取当前 Activity。
 *
 * 用 [AtomicReference] 保证跨线程安全；V1 仅一个 Activity（singleTask），始终持有当前实例。
 */
object ActivityRefProvider {
    private val ref = java.util.concurrent.atomic.AtomicReference<Activity>()

    /** 当前前台 Activity（可能为 null，如进程刚启动尚未创建 Activity 时）。 */
    val currentActivity: Activity? get() = ref.get()

    /** Activity 可见时调用（onResume）。 */
    fun onActivityResumed(activity: Activity) {
        ref.set(activity)
    }

    /** Activity 销毁时调用（onDestroy）。 */
    fun onActivityDestroyed(activity: Activity?) {
        ref.compareAndSet(activity, null)
    }
}
