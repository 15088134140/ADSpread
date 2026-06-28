package com.adspread.android.service

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.adspread.android.data.local.db.DownloadStatus
import com.adspread.android.data.local.db.dao.DownloadQueueDao
import com.adspread.android.data.repository.SyncResult
import com.adspread.android.data.repository.SyncRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * 设备全量同步 Worker（spec §5.1 / Task A7）。
 *
 * OneTime worker，由以下事件触发：
 * - WS `ad:update` 事件（通过 [SyncRepository.programChanged] 信号）
 * - 5min 兜底轮询（[com.adspread.android.data.remote.socket.DualChannelController.pollInterval]）
 * - WS 重连成功（[com.adspread.android.data.remote.socket.SocketIoClient.reconnectSignal]）
 * - [NetworkWatcher] 网络恢复
 * - 手动（开机首启等）
 *
 * **流程**：
 * 1. 调用 [SyncRepository.sync]（内部处理 ETag/304/diff/入队/发信号）。
 * 2. 同步成功后枚举 `download_queue` 中 PENDING 状态的素材，为每个素材入队 [DownloadWorker]。
 *    使用 [ExistingWorkPolicy.KEEP] 避免重复入队。
 * 3. 同步失败（Error）/跳过（SkippedUnbound/NotModified）不触发下载。
 */
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val syncRepository: SyncRepository,
    private val downloadQueueDao: DownloadQueueDao,
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        return when (val result = syncRepository.sync()) {
            is SyncResult.Synced -> {
                enqueueDownloadWorkers()
                Result.success()
            }
            is SyncResult.NotModified -> {
                // NotModified 也可能是上次 sync 没触发下载，保守检查
                enqueueDownloadWorkers()
                Result.success()
            }
            is SyncResult.SkippedUnbound -> Result.success()
            is SyncResult.Error -> {
                if (runAttemptCount < MAX_SYNC_RETRIES) {
                    Result.retry()
                } else {
                    Result.failure()
                }
            }
        }
    }

    /**
     * 枚举 download_queue 中 PENDING 状态的素材，为每素材创建一个 [DownloadWorker]。
     *
     * 使用 [ExistingWorkPolicy.KEEP]：如果同名 worker 已在队列中（等待/运行），不重复入队。
     */
    private suspend fun enqueueDownloadWorkers() {
        val pendingItems = downloadQueueDao.byStatus(DownloadStatus.PENDING.name)
        if (pendingItems.isEmpty()) return

        val workManager = WorkManager.getInstance(applicationContext)
        pendingItems.forEach { item ->
            val request = OneTimeWorkRequestBuilder<DownloadWorker>()
                .setInputData(workDataOf(DownloadWorker.KEY_MATERIAL_ID to item.materialId))
                .addTag(TAG_DOWNLOAD_GROUP)
                .build()

            workManager.enqueueUniqueWork(
                uniqueWorkName(item.materialId),
                ExistingWorkPolicy.KEEP,
                request,
            )
        }
    }

    companion object {
        /** 同步失败最大重试次数。 */
        const val MAX_SYNC_RETRIES = 3

        /** DownloadWorker 唯一名前缀。 */
        const val WORK_NAME_PREFIX = "download-"

        /** 下载组 tag，用于批量操作。 */
        const val TAG_DOWNLOAD_GROUP = "download"

        fun uniqueWorkName(materialId: Int) = "$WORK_NAME_PREFIX$materialId"
    }
}
