package com.adspread.android.app

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.adspread.android.data.local.db.dao.EventLogDao
import com.adspread.android.data.local.db.entity.EventLogEntity
import com.adspread.android.data.local.prefs.DeviceConfigStore
import com.adspread.android.data.local.prefs.SecurePrefs
import com.adspread.android.presentation.nav.AppNavHost
import com.adspread.android.presentation.theme.AdSpreadTheme
import com.adspread.android.service.BootReceiver
import com.adspread.android.service.PlayerService
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import javax.inject.Inject

/**
 * 唯一 Activity，承载 Compose 与 PlayerSurface（spec ADR-A）。
 *
 * A0 阶段为占位实现，仅渲染最简 Compose 内容以确保 `assembleDebug` 通过；
 * AppNavHost / 分屏渲染 / 绑定流程在 Task A10 接入。
 *
 * A9 新增：
 * - kiosk 模式（沉浸式 + 屏幕常亮 + 唤醒锁）
 * - BootReceiver 回调：[EXTRA_START_SERVICE] 检测 → 启动 [PlayerService]
 * - 设置密码入口：多点触控（5 次 / 2 秒）→ 密码对话框
 * - 崩溃记录导入 event_log
 *
 * A10 更新：
 * - 替换占位 Compose 内容为 [AppNavHost]（三目的地导航）
 * - 注入 [DeviceConfigStore] 供导航判断绑定状态
 *
 * **Activity 引用提供**：在 [onResume] / [onDestroy] 中维护 [ActivityRefProvider]，
 * 供 [CommandRouterImpl][com.adspread.android.service.orchestration.CommandRouterImpl]
 * 截图时通过 [ActivityRefProvider.currentActivity] 获取当前 Activity 实例。
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var eventLogDao: EventLogDao
    @Inject lateinit var securePrefs: SecurePrefs
    @Inject lateinit var deviceConfigStore: DeviceConfigStore

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // ---- BootReceiver 回调：开机完成后启动 PlayerService ----
        if (intent?.getBooleanExtra(BootReceiver.EXTRA_START_SERVICE, false) == true) {
            startPlayerService()
        }

        // ---- kiosk 模式 ----
        enableKioskMode()

        // ---- 崩溃计数重置 + event_log 导入 ----
        CrashHandler.onNormalStartup()
        importCrashRecordsToEventLog()

        // ---- Compose 内容（A10：AppNavHost） ----
        setContent {
            AdSpreadTheme {
                KioskContent(
                    deviceConfigStore = deviceConfigStore,
                    verifyPassword = { input -> verifySettingsPassword(input) },
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        ActivityRefProvider.onActivityResumed(this)
        // 每次恢复焦点时重新隐藏系统栏（防止用户用手势滑出后暴露）
        hideSystemBars()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemBars()
        }
    }

    override fun onDestroy() {
        ActivityRefProvider.onActivityDestroyed(this)
        releaseWakeLock()
        super.onDestroy()
    }

    // ===== kiosk 模式 ================================================================

    @Suppress("DEPRECATION")
    private fun enableKioskMode() {
        // 屏幕常亮
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // 沉浸式状态栏/导航栏
        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()

        // 唤醒锁（STAY_AWAKE）：8 小时上限，防止异常常亮
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "ADSpread:KioskWakeLock",
        ).apply {
            acquire(8 * 60 * 60 * 1000L)
        }
    }

    private fun hideSystemBars() {
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) it.release()
            wakeLock = null
        }
    }

    // ===== PlayerService 启动 =======================================================

    private fun startPlayerService() {
        val intent = Intent(this, PlayerService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    // ===== 崩溃导入 event_log ======================================================

    private fun importCrashRecordsToEventLog() {
        val records = CrashHandler.getPendingCrashRecords()
        if (records.isEmpty()) return

        CoroutineScope(Dispatchers.IO).launch {
            records.forEach { record ->
                val payload = buildString {
                    appendLine("线程: ${record.threadName}")
                    appendLine("异常: ${record.exceptionType}")
                    appendLine("消息: ${record.message}")
                    append(record.stackTrace)
                }
                eventLogDao.insert(
                    EventLogEntity(
                        type = "crash",
                        payload = payload,
                        severity = "ERROR",
                        createdAt = record.timestamp,
                        synced = 0,
                    )
                )
            }
            CrashHandler.clearCrashFiles()
        }
    }

    // ===== 设置密码入口 ============================================================

    /** 验证密码：密码为空则不验证直接进入。 */
    fun verifySettingsPassword(input: String): Boolean {
        val storedPassword = readSettingsPassword()
        return storedPassword.isEmpty() || storedPassword == input
    }

    private fun readSettingsPassword(): String {
        // 先尝试从 rawConfig（后端推送的配置）读取 settingsPassword
        val rawConfig = securePrefs.get(KEY_RAW_CONFIG)
        if (rawConfig != null) {
            try {
                val obj = jsonParser.parseToJsonElement(rawConfig) as? JsonObject
                val pwd = obj?.get("settingsPassword")?.jsonPrimitive?.content
                if (!pwd.isNullOrEmpty()) return pwd
            } catch (_: Exception) { /* 降级到本地 prefs */ }
        }
        // 降级到本地 prefs（无密码时返回空串 = 不验证）
        return getSettingsPrefs().getString(KEY_SETTINGS_PASSWORD, "") ?: ""
    }

    private fun saveSettingsPasswordLocally(password: String) {
        getSettingsPrefs().edit().putString(KEY_SETTINGS_PASSWORD, password).apply()
    }

    private fun getSettingsPrefs(): SharedPreferences =
        getSharedPreferences(PREFS_SETTINGS, Context.MODE_PRIVATE)

    companion object {
        private const val KEY_RAW_CONFIG = "rawConfig"
        private const val PREFS_SETTINGS = "adspread_settings"
        private const val KEY_SETTINGS_PASSWORD = "settingsPassword"
        private val jsonParser = Json { ignoreUnknownKeys = true }
    }
}

// ===== Compose 内容 =====================================================================

/**
 * kiosk 主内容（A10 用 AppNavHost 替换占位内容）。
 *
 * 检测多点触控（5 次 / 2 秒内）→ 触发密码对话框 → 导航到诊断页。
 */
@Composable
private fun KioskContent(
    deviceConfigStore: DeviceConfigStore,
    verifyPassword: (String) -> Boolean,
) {
    // 多击检测状态
    var tapCount by remember { mutableStateOf(0) }
    var lastTapTime by remember { mutableStateOf(0L) }
    val tapTimeoutMs = 2000L
    val requiredTaps = 5

    // 密码对话框状态
    var showDialog by remember { mutableStateOf(false) }
    var passwordInput by remember { mutableStateOf("") }
    var wrongPassword by remember { mutableStateOf(false) }

    // 导航到诊断页的信号（密码验证通过后触发）
    var showDiagnosticRequested by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent()
                        val now = System.currentTimeMillis()
                        event.changes.forEach { change ->
                            if (change.pressed) {
                                if (now - lastTapTime < tapTimeoutMs) {
                                    tapCount++
                                } else {
                                    tapCount = 1
                                }
                                lastTapTime = now
                                if (tapCount >= requiredTaps) {
                                    tapCount = 0
                                    showDialog = true
                                }
                                change.consume()
                            }
                        }
                    }
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        // ---- AppNavHost：三目的地导航 ----
        AppNavHost(
            deviceConfigStore = deviceConfigStore,
            onDiagnosticRequested = showDiagnosticRequested,
        )

        // 密码对话框
        if (showDialog) {
            AlertDialog(
                onDismissRequest = {
                    showDialog = false
                    wrongPassword = false
                    passwordInput = ""
                },
                title = { Text("设备设置") },
                text = {
                    Column {
                        if (CrashHandler.isSafeMode()) {
                            Text(
                                text = "安全模式：连续崩溃超过 ${CrashHandler.MAX_CRASH_BEFORE_SAFE} 次，" +
                                        "播放功能已降级。请联系管理员。",
                                color = MaterialTheme.colorScheme.error,
                                fontSize = 14.sp,
                            )
                            Spacer(Modifier.height(12.dp))
                        }
                        Text("请输入设置密码：")
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = passwordInput,
                            onValueChange = {
                                passwordInput = it
                                wrongPassword = false
                            },
                            label = { Text("密码") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Password,
                                imeAction = ImeAction.Done,
                            ),
                            keyboardActions = KeyboardActions(
                                onDone = {
                                    if (verifyPassword(passwordInput)) {
                                        showDialog = false
                                        wrongPassword = false
                                        passwordInput = ""
                                        showDiagnosticRequested = true
                                    } else {
                                        wrongPassword = true
                                    }
                                },
                            ),
                            isError = wrongPassword,
                            supportingText = if (wrongPassword) {
                                { Text("密码错误") }
                            } else null,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (verifyPassword(passwordInput)) {
                                showDialog = false
                                wrongPassword = false
                                passwordInput = ""
                                showDiagnosticRequested = true
                            } else {
                                wrongPassword = true
                            }
                        },
                    ) {
                        Text("进入")
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = {
                            showDialog = false
                            wrongPassword = false
                            passwordInput = ""
                        },
                    ) {
                        Text("取消")
                    }
                },
            )
        }
    }
}

/**
 * 占位引用持有者 —— 在 onResume/onDestroy 中维护当前 Activity 引用，
 * 供 CommandRouter 截图时通过 `ActivityRefProvider.currentActivity` 获取 Activity 实例。
 * 定义在 app 包内以避免跨包循环依赖。
 */
object ActivityRefProvider {
    @Volatile
    private var ref: MainActivity? = null

    val currentActivity: MainActivity? get() = ref

    fun onActivityResumed(activity: MainActivity) {
        ref = activity
    }

    fun onActivityDestroyed(activity: MainActivity) {
        if (ref === activity) {
            ref = null
        }
    }
}
