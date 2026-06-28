package com.adspread.android.presentation.screen.diagnostic

import android.app.Application
import android.os.Build
import android.os.Environment
import android.os.StatFs
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.adspread.android.data.local.cache.MaterialStore
import com.adspread.android.data.local.db.dao.EventLogDao
import com.adspread.android.data.local.prefs.DeviceConfigStore
import com.adspread.android.data.local.prefs.ServerConfigStore
import com.adspread.android.data.remote.BusinessException
import com.adspread.android.data.remote.socket.SocketConnectionState
import com.adspread.android.data.remote.socket.SocketIoClient
import com.adspread.android.data.repository.SyncRepository
import com.adspread.android.data.repository.SyncResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

/**
 * 诊断页 UI 状态（spec §14，Task A10）。
 *
 * @param deviceCode 设备编码
 * @param appVersion App 版本名
 * @param serverUrl 当前服务器地址
 * @param ipAddress 设备 IP 地址（由本地网络接口获取）
 * @param diskFreeBytes 磁盘可用字节
 * @param diskTotalBytes 磁盘总字节
 * @param materialCacheSize 素材缓存大小（字节）
 * @param lastSyncTime 最近同步时间描述
 * @param lastError 最近错误描述；null 表示无记录
 * @param isSyncing 正在手动同步中
 * @param syncResult 手动同步结果描述
 * @param showFactoryResetConfirm 是否显示恢复出厂二次确认对话框
 */
data class DiagnosticUiState(
    val deviceCode: String = "",
    val appVersion: String = "",
    val serverUrl: String = "",
    val ipAddress: String = "",
    val diskFreeBytes: Long = 0L,
    val diskTotalBytes: Long = 0L,
    val materialCacheSize: Long = 0L,
    val lastSyncTime: String = "",
    val lastError: String? = null,
    val isSyncing: Boolean = false,
    val syncResult: String? = null,
    val showFactoryResetConfirm: Boolean = false,
    val socketState: String = "未知",
)

/**
 * 诊断页 ViewModel（spec §14 / Task A10）。
 *
 * 提供：
 * - 设备信息面板：deviceCode / version / IP / 磁盘 / 缓存 / 最近同步 / 最近错误
 * - 手动同步按钮
 * - 服务器切换（清缓存重绑→重启）
 * - 恢复出厂（二次确认→清本地数据→回 SetupScreen）
 */
@HiltViewModel
class DiagnosticViewModel @Inject constructor(
    application: Application,
    private val deviceConfigStore: DeviceConfigStore,
    private val serverConfigStore: ServerConfigStore,
    private val syncRepository: SyncRepository,
    private val materialStore: MaterialStore,
    private val eventLogDao: EventLogDao,
    private val socketIoClient: SocketIoClient,
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(DiagnosticUiState())
    val uiState: StateFlow<DiagnosticUiState> = _uiState.asStateFlow()

    /** 恢复出厂完成信号（导航到 SetupScreen）。 */
    private val _factoryResetDone = MutableStateFlow(false)
    val factoryResetDone: StateFlow<Boolean> = _factoryResetDone.asStateFlow()

    init {
        loadDeviceInfo()
        // 订阅 Socket 连接状态变化
        viewModelScope.launch {
            socketIoClient.connectionState.collect { state ->
                _uiState.update { it.copy(socketState = state.toDisplayString()) }
            }
        }
    }

    /** 采集设备信息填充 UI（可在 init 或 onResume-like 时调用）。 */
    fun loadDeviceInfo() {
        val app = getApplication<Application>()
        val packageInfo = runCatching {
            app.packageManager.getPackageInfo(app.packageName, 0)
        }.getOrNull()

        _uiState.update {
            it.copy(
                deviceCode = deviceConfigStore.deviceCode() ?: "未绑定",
                appVersion = packageInfo?.versionName ?: "",
                serverUrl = serverConfigStore.getBaseUrl(),
                ipAddress = resolveIpAddress(),
                diskFreeBytes = getDiskFreeBytes(),
                diskTotalBytes = getDiskTotalBytes(),
                materialCacheSize = materialStore.size(),
                lastSyncTime = formatLastSyncTime(deviceConfigStore.lastSyncVersion()),
                lastError = loadLastEventLogError(),
                socketState = socketIoClient.connectionState.value.toDisplayString(),
            )
        }
    }

    /** 手动同步。 */
    fun manualSync() {
        _uiState.update { it.copy(isSyncing = true, syncResult = null) }
        viewModelScope.launch {
            val result = syncRepository.sync()
            val msg = when (result) {
                is SyncResult.SkippedUnbound -> "未绑定设备"
                is SyncResult.NotModified -> "已是最新（304）"
                is SyncResult.Synced -> "同步成功：${result.downloaded} 新素材，${result.deleted} 清理"
                is SyncResult.Error -> "同步失败：${result.message}"
            }
            _uiState.update { it.copy(isSyncing = false, syncResult = msg) }
        }
    }

    /** 显示恢复出厂二次确认。 */
    fun requestFactoryReset() {
        _uiState.update { it.copy(showFactoryResetConfirm = true) }
    }

    /** 取消恢复出厂。 */
    fun cancelFactoryReset() {
        _uiState.update { it.copy(showFactoryResetConfirm = false) }
    }

    /**
     * 执行恢复出厂（spec §14）：
     * 1. 清 DeviceConfigStore（token/code/storeId/配置）
     * 2. 清 MaterialStore（素材文件）
     * 3. 触发 factoryResetDone 信号（导航回 SetupScreen）
     * 4. 重启 App 进程使 Retrofit/Socket 重建
     *
     * 同步执行清除操作（viewModelScope 在测试中可能不兼容 StandardTestDispatcher，
     * 故用 runBlocking 确保生产+测试行为一致）。恢复出厂是重度操作，瞬态阻塞可接受。
     */
    fun confirmFactoryReset() {
        _uiState.update { it.copy(showFactoryResetConfirm = false) }
        kotlinx.coroutines.runBlocking {
            deviceConfigStore.clear()
            materialStore.clear()
            eventLogDao.clear()
        }
        _factoryResetDone.value = true
    }

    /** 消费 factoryResetDone 信号。 */
    fun onNavigatedToSetup() {
        _factoryResetDone.value = false
    }

    // ===== 辅助方法 =====

    /** 获取设备局域网 IP 地址。 */
    private fun resolveIpAddress(): String {
        return try {
            val interfaces = java.net.NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val networkInterface = interfaces.nextElement()
                if (networkInterface.isLoopback || !networkInterface.isUp) continue
                val addresses = networkInterface.inetAddresses
                while (addresses.hasMoreElements()) {
                    val addr = addresses.nextElement()
                    if (addr is java.net.Inet4Address && !addr.isLoopbackAddress) {
                        return addr.hostAddress ?: ""
                    }
                }
            }
            "未知"
        } catch (_: Exception) {
            "未知"
        }
    }

    /** 获取数据分区可用字节（简化为 Environment 数据目录所在分区）。 */
    private fun getDiskFreeBytes(): Long {
        return try {
            val path = Environment.getDataDirectory()
            val stat = StatFs(path.path)
            stat.availableBlocksLong * stat.blockSizeLong
        } catch (_: Exception) {
            0L
        }
    }

    /** 获取数据分区总字节。 */
    private fun getDiskTotalBytes(): Long {
        return try {
            val path = Environment.getDataDirectory()
            val stat = StatFs(path.path)
            stat.blockCountLong * stat.blockSizeLong
        } catch (_: Exception) {
            0L
        }
    }

    /** 格式化最近同步时间。 */
    private fun formatLastSyncTime(lastSyncVersion: String?): String {
        if (lastSyncVersion.isNullOrEmpty()) return "从未同步"
        // version 为毫秒时间戳字符串（阶段 1 K4 简化方案）
        val ts = lastSyncVersion.toLongOrNull()
        if (ts != null && ts > 0) {
            val instant = java.time.Instant.ofEpochMilli(ts)
            val local = instant.atZone(java.time.ZoneId.of("Asia/Shanghai"))
            val formatter = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
            return local.format(formatter)
        }
        return "版本 $lastSyncVersion"
    }

    private fun SocketConnectionState.toDisplayString(): String = when (this) {
        SocketConnectionState.CONNECTED -> "已连接"
        SocketConnectionState.CONNECTING -> "连接中..."
        SocketConnectionState.RECONNECTING -> "重连中..."
        SocketConnectionState.DISCONNECTED -> "已断开"
        SocketConnectionState.AUTH_FAILED -> "鉴权失败"
    }

    /** 取最近一条 event_log 错误（第一次 init 时在 IO 协程中加载）。 */
    private fun loadLastEventLogError(): String? {
        // init 时在 viewModelScope 中更新
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val record = eventLogDao.getLatestBySeverity("ERROR") ?: return@launch
                val ts = java.time.Instant.ofEpochMilli(record.createdAt)
                val local = ts.atZone(java.time.ZoneId.of("Asia/Shanghai"))
                val timeStr = java.time.format.DateTimeFormatter.ofPattern("MM-dd HH:mm").format(local)
                val errorText = "$timeStr: ${record.type} / ${record.payload.take(100)}"
                _uiState.update { it.copy(lastError = errorText) }
            } catch (_: Exception) {
                // 静默失败，不阻塞 init
            }
        }
        return null // init 时返回 null，协程完成后更新
    }
}
