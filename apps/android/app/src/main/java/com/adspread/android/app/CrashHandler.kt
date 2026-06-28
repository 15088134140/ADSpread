package com.adspread.android.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.SystemClock
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

/**
 * 全局未捕获异常处理器（spec §12 崩溃自愈，Task A9）。
 *
 * ## 职责
 * 1. [Thread.setDefaultUncaughtExceptionHandler] 在 [AdSpreadApp.onCreate] 注册。
 * 2. 崩溃时：递增连续崩溃计数 → 写 [CrashRecord] JSON 文件落盘 → 通过 [AlarmManager] 延时重启。
 * 3. 连续崩溃 > [MAX_CRASH_BEFORE_SAFE] 次进入安全模式（[isSafeMode]），后续启动可据此降级。
 * 4. 正常启动后由 [onNormalStartup] 重置计数和标志。
 * 5. [getPendingCrashRecords] / [clearCrashFiles] 供 Activity 将崩溃记录导入 Room event_log。
 *
 * ## 设计说明
 * - 使用**普通 [SharedPreferences]**（非加密），仅存计数和标志，不含敏感凭据。
 * - 崩溃期间 Room 可能不一致，故崩溃详情写入独立 JSON 文件，下次启动再导入 event_log。
 * - [AlarmManager] ELAPSED_REALTIME 重启不受设备休眠影响。
 */
class CrashHandler private constructor(
    private val appContext: Context,
) : Thread.UncaughtExceptionHandler {

    private val defaultHandler: Thread.UncaughtExceptionHandler? = Thread.getDefaultUncaughtExceptionHandler()
    private val prefs: SharedPreferences = appContext.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
    private val crashDir: File = File(appContext.filesDir, CRASH_DIR).also { it.mkdirs() }
    private val json: Json = Json { prettyPrint = true }

    override fun uncaughtException(t: Thread, e: Throwable) {
        val count = prefs.getInt(KEY_CRASH_COUNT, 0) + 1

        prefs.edit()
            .putInt(KEY_CRASH_COUNT, count)
            .putLong(KEY_LAST_CRASH_MS, System.currentTimeMillis())
            .apply()

        if (count > MAX_CRASH_BEFORE_SAFE) {
            prefs.edit().putBoolean(KEY_SAFE_MODE, true).apply()
        }

        writeCrashRecord(t, e)
        scheduleRestart()
        defaultHandler?.uncaughtException(t, e)
    }

    // ===== 崩溃文件 =================================================================

    private fun writeCrashRecord(t: Thread, e: Throwable) {
        val record = CrashRecord(
            timestamp = System.currentTimeMillis(),
            threadName = t.name,
            exceptionType = e::class.qualifiedName ?: e.javaClass.name,
            message = e.message ?: "(no message)",
            stackTrace = e.stackTraceToString(),
        )
        val fileName = "crash_${record.timestamp}_${record.hashCode()}.json"
        val file = File(crashDir, fileName)
        runCatching { file.writeText(json.encodeToString(record)) }
    }

    /** 读取尚未处理的崩溃记录文件列表。 */
    fun readPendingCrashRecords(): List<CrashRecord> =
        crashDir.listFiles()
            ?.mapNotNull { file ->
                runCatching { json.decodeFromString<CrashRecord>(file.readText()) }.getOrNull()
            }
            ?: emptyList()

    /** 删除已处理的崩溃记录文件。 */
    fun clearCrashFiles() {
        crashDir.listFiles()?.forEach { it.delete() }
    }

    // ===== 自愈重启 =================================================================

    private fun scheduleRestart() {
        val restartIntent = Intent(appContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            appContext,
            RC_RESTART,
            restartIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val alarm = appContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarm.set(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + RESTART_DELAY_MS,
            pendingIntent,
        )
    }

    // ===== 安全模式查询 =================================================================

    fun isSafeMode(): Boolean = prefs.getBoolean(KEY_SAFE_MODE, false)

    fun getCrashCount(): Int = prefs.getInt(KEY_CRASH_COUNT, 0)

    /** 正常启动后重置崩溃计数和安全模式标志。 */
    fun onNormalStartup() {
        prefs.edit()
            .putInt(KEY_CRASH_COUNT, 0)
            .putBoolean(KEY_SAFE_MODE, false)
            .apply()
    }

    companion object {
        private const val PREFS_FILE = "adspread_crash_prefs"
        private const val CRASH_DIR = "crash_logs"
        private const val KEY_CRASH_COUNT = "crashCount"
        private const val KEY_LAST_CRASH_MS = "lastCrashMs"
        private const val KEY_SAFE_MODE = "safeMode"
        private const val RC_RESTART = 0xCAFE

        /** 自愈重启延迟（毫秒），给系统时间写完崩溃日志。 */
        private const val RESTART_DELAY_MS = 3000L

        /** 连续崩溃超过此阈值 → 安全模式。 */
        const val MAX_CRASH_BEFORE_SAFE = 3

        @Volatile
        private var instance: CrashHandler? = null

        /**
         * 在 Application.onCreate 中调用，安装为默认未捕获异常处理器。
         */
        fun install(context: Context) {
            val handler = CrashHandler(context.applicationContext)
            instance = handler
            Thread.setDefaultUncaughtExceptionHandler(handler)
        }

        /** 当前是否处于安全模式（连续崩溃 > [MAX_CRASH_BEFORE_SAFE]）。 */
        fun isSafeMode(): Boolean = instance?.isSafeMode() ?: false

        /** 当前连续崩溃次数。 */
        fun getCrashCount(): Int = instance?.getCrashCount() ?: 0

        /** 正常启动后重置。 */
        fun onNormalStartup() {
            instance?.onNormalStartup()
        }

        /** 返回待处理的崩溃记录，供 Activity 插入 event_log。 */
        fun getPendingCrashRecords(): List<CrashRecord> =
            instance?.readPendingCrashRecords() ?: emptyList()

        /** 清除已导入的崩溃文件。 */
        fun clearCrashFiles() {
            instance?.clearCrashFiles()
        }

        /**
         * 测试专用：完全重置 CrashHandler 状态。
         * 清空 Prefs、丢弃实例引用、移除默认异常处理器。
         */
        fun resetForTesting(context: Context) {
            instance?.prefs?.edit()?.clear()?.apply()
            instance = null
            Thread.setDefaultUncaughtExceptionHandler(null)
            // 确保文件也被清理
            File(context.filesDir, CRASH_DIR).let { dir ->
                if (dir.exists()) dir.listFiles()?.forEach { it.delete() }
            }
        }
    }
}

/**
 * 崩溃记录，序列化为 JSON 文件落盘（Task A9）。
 */
@Serializable
data class CrashRecord(
    val timestamp: Long,
    val threadName: String,
    val exceptionType: String,
    val message: String,
    val stackTrace: String,
)
