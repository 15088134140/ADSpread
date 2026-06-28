package com.adspread.android.service

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.adspread.android.data.local.db.DownloadStatus
import com.adspread.android.data.local.db.MaterialState
import com.adspread.android.data.local.cache.MaterialStore
import com.adspread.android.data.local.db.dao.DownloadQueueDao
import com.adspread.android.data.local.db.dao.MaterialMetaDao
import com.adspread.android.data.remote.MaterialDownloader
import com.adspread.android.domain.schedule.TimeProvider
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.io.File

/**
 * 单个素材下载 Worker（spec §5.3 / Task A7）。
 *
 * OneTime worker，每素材一个实例。由 [SyncWorker] 在同步成功后入队。
 *
 * **流程**：
 * 1. 从 inputData 取 materialId。
 * 2. 从 [DownloadQueueDao] 取下载队列记录（含 url / localPath / totalBytes / retries）。
 * 3. 若已 COMPLETED 或不存在 → 直接返回 success（幂等）。
 * 4. 标 status=DOWNLOADING → 调 [MaterialDownloader.download]（Range 续传 + size 校验）。
 * 5. 成功 → [MaterialMetaDao.setLocalPath] + markState(READY) + 队列标 COMPLETED。
 * 6. 失败 + retries < MAX_RETRIES → 队列标 PENDING（不触发 [Result.retry]，由下行 RunAttemptCount 控制）。
 * 7. 失败 + retries >= MAX_RETRIES → [MaterialMetaDao.markState(CORRUPT)] + 队列 FAILED。
 *
 * 并发限制：WorkManager 默认线程池 3 线程 → 自然限制 2~3 并发下载。
 */
@HiltWorker
class DownloadWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val materialDownloader: MaterialDownloader,
    private val downloadQueueDao: DownloadQueueDao,
    private val materialMetaDao: MaterialMetaDao,
    private val materialStore: MaterialStore,
    private val timeProvider: TimeProvider,
    private val serverConfigStore: com.adspread.android.data.local.prefs.ServerConfigStore,
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val materialId = inputData.getInt(KEY_MATERIAL_ID, -1)
        if (materialId == -1) return Result.failure()

        val queueItem = downloadQueueDao.getById(materialId)
            ?: return Result.success() // 队列无此记录 = 已被清理或从未入队
        if (queueItem.status == DownloadStatus.COMPLETED.name) return Result.success() // 幂等

        // 标记开始下载
        downloadQueueDao.markStatus(
            materialId = materialId,
            status = DownloadStatus.DOWNLOADING.name,
            error = null,
            retries = queueItem.retries,
        )

        val destFile = if (File(queueItem.localPath).exists()) {
            File(queueItem.localPath)
        } else {
            // localPath 可能在设备重启后丢失（临时目录等），用 MaterialStore 重新计算
            materialStore.pathFor(materialId)
        }

        // 拼接完整 URL：fileUrl 为相对路径 /uploads/materials/...，需加上服务器主机（去掉 /api/ 后缀）
        val fullUrl = serverConfigStore.hostForStatic() + queueItem.url
        Log.d("DownloadWorker", "download material=$materialId url=$fullUrl queueUrl=${queueItem.url}")

        val downloadResult = materialDownloader.download(
            url = fullUrl,
            destFile = destFile,
            expectedSize = queueItem.totalBytes,
        )

        val now = timeProvider.now().toEpochMilli()

        return when (downloadResult) {
            is MaterialDownloader.DownloadResult.Success -> {
                // 下载完成：写路径/大小 → 置 READY
                materialMetaDao.setLocalPath(
                    id = materialId,
                    path = destFile.absolutePath,
                    size = downloadResult.totalBytes,
                    state = MaterialState.READY.name,
                    updatedAt = now,
                )
                downloadQueueDao.markStatus(
                    materialId = materialId,
                    status = DownloadStatus.COMPLETED.name,
                    error = null,
                    retries = queueItem.retries,
                )
                Result.success()
            }
            is MaterialDownloader.DownloadResult.Failed -> {
                val newRetries = queueItem.retries + 1
                if (newRetries >= MAX_RETRIES) {
                    // 重试耗尽：标 CORRUPT + FAILED
                    materialMetaDao.markState(
                        id = materialId,
                        state = MaterialState.CORRUPT.name,
                        updatedAt = now,
                    )
                    downloadQueueDao.markStatus(
                        materialId = materialId,
                        status = DownloadStatus.FAILED.name,
                        error = downloadResult.reason,
                        retries = newRetries,
                    )
                    Result.failure()
                } else {
                    // 未达上限：将队列重置为 PENDING，下次 SyncWorker 循环会重新入队
                    downloadQueueDao.markStatus(
                        materialId = materialId,
                        status = DownloadStatus.PENDING.name,
                        error = downloadResult.reason,
                        retries = newRetries,
                    )
                    Result.retry()
                }
            }
        }
    }

    companion object {
        const val KEY_MATERIAL_ID = "material_id"
        const val MAX_RETRIES = 3
    }
}
