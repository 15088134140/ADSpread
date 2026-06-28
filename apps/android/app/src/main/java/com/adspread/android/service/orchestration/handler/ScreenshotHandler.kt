package com.adspread.android.service.orchestration.handler

import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 截图指令处理器（`command:screenshot`）。
 *
 * 实际截图捕获由 [CommandRouterImpl][com.adspread.android.service.orchestration.CommandRouterImpl]
 * 在 handler 执行后调用 [ScreenshotCapture][com.adspread.android.service.orchestration.ScreenshotCapture]
 * 完成，本 handler 仅返回 SUCCESS 以标识指令可达性验证通过。
 * 截图文件路径通过 ack 的 screenshotUrl 参数回传。
 */
@Singleton
class ScreenshotHandler @Inject constructor() : CommandHandler {

    override fun execute(payload: CommandPayload): CommandResult {
        // 实际截图在 CommandRouterImpl.routeAndAck 中处理
        return CommandResult.SUCCESS
    }
}
