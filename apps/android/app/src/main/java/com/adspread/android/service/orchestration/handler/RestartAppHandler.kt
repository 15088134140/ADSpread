package com.adspread.android.service.orchestration.handler

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Process
import com.adspread.android.app.MainActivity
import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 重启应用处理器（`command:restart_app`）。
 *
 * 使用 [AlarmManager] 在短延迟后启动 [MainActivity]（绕过当前进程已退出的限制），
 * 然后调用 [Process.killProcess] 终止当前进程。
 *
 * **流程**：
 * 1. 注册 [AlarmManager.setExact]（API 31+ 需 SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM 权限）
 *   → 延迟 500ms 启动 MainActivity（[PendingIntent] + [Intent.FLAG_ACTIVITY_NEW_TASK]）；
 * 2. 当前线程 sleep 100ms 确保 Alarm 已注册；
 * 3. [Process.killProcess] 终止自身进程，OS 随后触发 Alarm 拉起 Activity → Application
 *    onCreate → 重新初始化 PlayerService。
 *
 * **风险**：killProcess 后进程立即终止，AlarmManager 经 OS 调度恢复。延迟 500ms 为安全缓冲，
 * 避免竞争条件。V1 目标盒子通常空闲，500ms 足够写入 Alarm。
 *
 * **已声明权限**：Manifest 已声明 SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM（见 Task A9）。
 */
@Singleton
class RestartAppHandler @Inject constructor(
    @ApplicationContext private val context: Context,
) : CommandHandler {

    override fun execute(payload: CommandPayload): CommandResult {
        return try {
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                putExtra(EXTRA_RESTART, true)
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                REQUEST_CODE_RESTART,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.setExact(
                AlarmManager.RTC,
                System.currentTimeMillis() + RESTART_DELAY_MS,
                pendingIntent,
            )
            // 短暂等待确保 Alarm 已写入系统
            Thread.sleep(100)
            Process.killProcess(Process.myPid())
            // killProcess 后不会执行到此行，但方法签名需要返回
            CommandResult.SUCCESS
        } catch (e: Exception) {
            CommandResult.FAILED
        }
    }

    private companion object {
        const val REQUEST_CODE_RESTART = 9001
        const val RESTART_DELAY_MS = 500L
        const val EXTRA_RESTART = "restart_from_crash"
    }
}
