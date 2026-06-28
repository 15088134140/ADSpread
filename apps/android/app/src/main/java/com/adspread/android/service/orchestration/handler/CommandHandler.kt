package com.adspread.android.service.orchestration.handler

import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult

/**
 * 指令处理器端口（spec §6.2 / A8）。
 *
 * 每个 [CommandHandler] 对应一个 `supported=true` 的 [Command][com.adspread.android.domain.command.Command]。
 * 由 [CommandRouterImpl][com.adspread.android.service.orchestration.CommandRouterImpl] 在收到指令事件后
 * 按 Command 查找对应的 handler 并调 [execute]。
 *
 * 所有处理器在主线程执行（PlayerService 编排协程上下文）；耗时操作（如 fetch_logs 的 logcat 读取）应
 * 在内部切 [Dispatchers.IO]。
 */
fun interface CommandHandler {
    /** 执行指令，返回结果。异常抛出由 [CommandRouterImpl] 捕获转为 [CommandResult.FAILED]。 */
    fun execute(payload: CommandPayload): CommandResult
}
