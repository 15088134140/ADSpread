package com.adspread.android.service.orchestration

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.adspread.android.data.remote.api.DeviceLifecycleApi
import com.adspread.android.data.repository.LogRepository
import com.adspread.android.data.repository.UploadResult
import com.adspread.android.service.SyncWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 网络恢复监听器（spec §5.5 / Task A7）。
 *
 * 使用 [ConnectivityManager.NetworkCallback] 监听网络从断连到恢复的切换。恢复时：
 * 1. 入队 [SyncWorker] 触发全量同步（ETag/304 可跳过，重连后的首次同步可能拉取离线下发的指令变更）。
 * 2. 批量上报缓冲日志（[LogRepository.uploadBatch]）。
 * 3. 拉取待下发指令（[DeviceLifecycleApi.pendingCommands]——P1 接口，V1 可能无实现，保留调用）。
 *
 * **生命周期**：由调用方在适当时机调 [start]/[stop]（如 PlayerService onStartCommand/onDestroy）。
 * 内部持有 [CoroutineScope] 用于调度异步操作。
 *
 * **线程安全**：[registerNetworkCallback]/[unregisterNetworkCallback] 在主线程调用；
 * [NetworkCallback] 回调在 binder 线程触发，通过 [scope.launch] 切换到 IO 调度。
 */
@Singleton
class NetworkWatcher @Inject constructor(
    private val context: Context,
    private val logRepository: LogRepository,
    private val lifecycleApi: DeviceLifecycleApi,
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private var isStarted = false

    /** 上次可用网络状态——从 DISCONNECTED→可用 时触发恢复逻辑。 */
    private var lastAvailable = false

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            if (!lastAvailable) {
                lastAvailable = true
                onNetworkRecovered()
            }
        }

        override fun onLost(network: Network) {
            lastAvailable = false
        }

        override fun onCapabilitiesChanged(
            network: Network,
            networkCapabilities: NetworkCapabilities,
        ) {
            val connected = networkCapabilities.hasCapability(
                NetworkCapabilities.NET_CAPABILITY_INTERNET
            )
            if (connected && !lastAvailable) {
                lastAvailable = true
                onNetworkRecovered()
            } else if (!connected) {
                lastAvailable = false
            }
        }
    }

    /**
     * 注册网络回调，开始监听。
     *
     * 幂等：重复调用只生效一次。
     */
    fun start() {
        if (isStarted) return
        isStarted = true
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        connectivityManager.registerNetworkCallback(request, networkCallback)
        // 初始探测当前网络状态
        val activeNetwork = connectivityManager.activeNetwork
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork)
        lastAvailable = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    }

    /**
     * 注销网络回调。幂等。
     */
    fun stop() {
        if (!isStarted) return
        isStarted = false
        connectivityManager.unregisterNetworkCallback(networkCallback)
    }

    /**
     * 网络恢复处理逻辑。
     *
     * 在 IO 协程中异步执行，异常不抛给调用方（吞为 log，不中断后续处理）。
     */
    private fun onNetworkRecovered() {
        scope.launch {
            // 1. 入队 SyncWorker（KEEP 避免重复——若已有同名 worker 在队列中则跳过）
            enqueueSyncWorker()

            // 2. 批量上报缓冲日志
            uploadBufferedLogs()

            // 3. 拉取待下发指令（P1 接口，V1 后端未实现，保留调用）
            fetchPendingCommands()
        }
    }

    private suspend fun enqueueSyncWorker() {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .addTag(TAG_SYNC)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork(UNIQUE_SYNC_NAME, ExistingWorkPolicy.KEEP, request)
    }

    private suspend fun uploadBufferedLogs() {
        try {
            when (logRepository.uploadBatch()) {
                is UploadResult.Uploaded -> { /* 已上传，行已清理 */ }
                is UploadResult.SkippedUnbound,
                is UploadResult.Nothing,
                is UploadResult.Error -> { /* 无需处理 */ }
            }
        } catch (_: Exception) {
            // 异常不中断后续处理，静默吞掉
        }
    }

    private suspend fun fetchPendingCommands() {
        try {
            lifecycleApi.pendingCommands()
        } catch (_: Exception) {
            // P1 接口 V1 后端未暴露 HTTP 端点，异常预期内，静默吞掉
        }
    }

    companion object {
        const val UNIQUE_SYNC_NAME = "sync"
        const val TAG_SYNC = "sync"
    }
}
