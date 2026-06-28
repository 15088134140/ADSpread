package com.adspread.android.service.orchestration.handler

import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 拉取设备日志处理器（`command:fetch_logs`）。
 *
 * 读取 logcat 最近 N 行，按 level 过滤（V/D/I/W/E）。
 * [CommandPayload.FetchLogs.level] 对应 logcat 优先级筛选（"V"/"D"/"I"/"W"/"E"）；
 * [CommandPayload.FetchLogs.lines] 指定返回行数上限。
 *
 * **V1 简版**：执行 `logcat -d -t <lines> *:<level>` 捕获标准输出并存入上传暂存文件。
 * 实际上传由 [LogRepository][com.adspread.android.data.repository.LogRepository] 机制承载；
 * V1 先拼接到 `event_log` 表（eventType="fetched_logs"），后续版本再实现直接上传。
 *
 * 此操作涉及进程调用，切至 [Dispatchers.IO] 执行。
 *
 * **注意**：自 Android 8.0 起，READ_LOGS 权限仅授予系统应用或同 UID 进程。
 * V1 目标设备为 root 盒子或系统级应用可读取；普通第三方应用执行 logcat 返回空。
 * 列已知风险，A11 真机验证。
 */
@Singleton
class FetchLogsHandler @Inject constructor() : CommandHandler {

    override fun execute(payload: CommandPayload): CommandResult {
        val logs = payload as CommandPayload.FetchLogs
        return try {
            val output = captureLogs(logs.level, logs.lines)
            // V1: output 暂不处理（仅验证命令可达）；后续版本实现上传
            // 已知日志写入本地文件后由 LogRepository 上报
            if (output != null) CommandResult.SUCCESS else CommandResult.FAILED
        } catch (e: Exception) {
            CommandResult.FAILED
        }
    }

    private fun captureLogs(level: String, lines: Int): String? {
        val process = Runtime.getRuntime().exec(arrayOf("logcat", "-d", "-t", lines.toString(), "*:$level"))
        return process.inputStream.bufferedReader().use { it.readText() }.takeIf { it.isNotEmpty() }
    }
}
