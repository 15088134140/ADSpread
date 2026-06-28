package com.adspread.android.presentation.screen.setup

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.adspread.android.data.local.prefs.ServerConfigStore
import com.adspread.android.data.remote.BusinessException
import android.content.Context
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.adspread.android.data.remote.dto.BindReq
import com.adspread.android.data.remote.dto.HardwareInfoDto
import com.adspread.android.data.repository.BindResult
import com.adspread.android.data.repository.DeviceRepository
import com.adspread.android.service.SyncWorker
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * 首启配置 UI 状态（spec §9）。
 *
 * @param serverUrl 后端服务器地址（输入中）
 * @param deviceCode 设备编码（输入中）
 * @param isBinding 正在绑定中
 * @param error 绑定错误提示；null 表示无错误
 * @param boundSuccess 绑定成功标志（导航到 PlayerScreen 的触发信号）
 */
data class SetupUiState(
    val serverUrl: String = "http://10.0.2.2:3000/api",
    val deviceCode: String = "DEV001",
    val isBinding: Boolean = false,
    val error: String? = null,
    val boundSuccess: Boolean = false,
)

/**
 * 首启配置 ViewModel（spec §9 / §14，Task A10）。
 *
 * 职责：
 * 1. 输入校验 & 持久化服务器地址 → POST /device/bind → 持久化 token
 * 2. 绑定结果映射为 SetupUiState（成功/失败/错误分类）
 * 3. DEVICE_NOT_FOUND（40004）/ 网络不可达等错误文案
 *
 * @see DeviceRepository.bind
 * @see ServerConfigStore.setBaseUrl
 */
@HiltViewModel
class SetupViewModel @Inject constructor(
    private val deviceRepository: DeviceRepository,
    private val serverConfigStore: ServerConfigStore,
    private val syncRepository: com.adspread.android.data.repository.SyncRepository,
    @ApplicationContext private val appContext: Context,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SetupUiState())
    val uiState: StateFlow<SetupUiState> = _uiState.asStateFlow()

    fun onServerUrlChange(url: String) {
        _uiState.update { it.copy(serverUrl = url, error = null) }
    }

    fun onDeviceCodeChange(code: String) {
        _uiState.update { it.copy(deviceCode = code, error = null) }
    }

    /**
     * 执行绑定流程：
     * 1. 校验非空
     * 2. 持久化服务器地址
     * 3. POST /device/bind
     * 4. 成功→boundSuccess 导航；失败→更新 error
     */
    fun bind() {
        val state = _uiState.value
        val trimmedUrl = state.serverUrl.trim()
        val trimmedCode = state.deviceCode.trim()

        // 输入校验
        if (trimmedUrl.isEmpty()) {
            _uiState.update { it.copy(error = "请输入服务器地址") }
            return
        }
        if (trimmedCode.isEmpty()) {
            _uiState.update { it.copy(error = "请输入设备编码") }
            return
        }

        _uiState.update { it.copy(isBinding = true, error = null) }

        viewModelScope.launch {
            // 持久化服务器地址（绑定时一次写入；切换服务器走诊断页→恢复出厂→重启）
            serverConfigStore.setBaseUrl(trimmedUrl)

            val hardwareInfo = HardwareInfoDto(
                androidId = null,  // 由 data 层在 bind 时采集
                model = null,
                resolution = null,
                androidVersion = null,
                appVersion = null,
            )

            when (val result = deviceRepository.bind(BindReq(code = trimmedCode, hardwareInfo = hardwareInfo))) {
                is BindResult.Success -> {
                    // 立即 sync 填充 Room 元数据（供 PlayerController 首次解析）
                    try { syncRepository.sync() } catch (_: Exception) {}
                    // 然后触发 SyncWorker（含 DownloadWorker 入队，负责真正下载素材文件）
                    WorkManager.getInstance(appContext).enqueue(
                        OneTimeWorkRequestBuilder<SyncWorker>().build()
                    )
                    _uiState.update { it.copy(isBinding = false, boundSuccess = true) }
                }
                is BindResult.Failed -> {
                    val message = classifyError(result.message)
                    _uiState.update { it.copy(isBinding = false, error = message) }
                }
            }
        }
    }

    /** 绑定成功后重置 boundSuccess（供导航到 PlayerScreen 后消费一次）。 */
    fun onNavigatedToPlayer() {
        _uiState.update { it.copy(boundSuccess = false) }
    }

    /**
     * 将原始错误消息映射为用户友好文案。
     *
     * 后端 DEVICE_NOT_FOUND 业务码 40004（BusinessException.code=40004），
     * IOException 代表网络不可达。
     */
    private fun classifyError(rawMessage: String): String = when {
        rawMessage.contains("DEVICE_NOT_FOUND", ignoreCase = true) ||
        rawMessage.contains("40004", ignoreCase = true) ||
        rawMessage.contains("设备") && rawMessage.contains("不存在", ignoreCase = true) -> "设备编码不存在，请确认后重试"
        rawMessage.contains("网络", ignoreCase = true) ||
        rawMessage.contains("timeout", ignoreCase = true) ||
        rawMessage.contains("Unable to resolve host", ignoreCase = true) ||
        rawMessage.contains("Failed to connect", ignoreCase = true) ||
        rawMessage.contains("Connection refused", ignoreCase = true) -> "无法连接到服务器，请检查网络和地址"
        rawMessage.contains("already bound", ignoreCase = true) ||
        rawMessage.contains("已绑定", ignoreCase = true) -> "设备已被绑定，请联系管理员"
        else -> "绑定失败：$rawMessage"
    }
}
