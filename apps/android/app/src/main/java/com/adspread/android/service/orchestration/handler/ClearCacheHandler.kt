package com.adspread.android.service.orchestration.handler

import android.content.Context
import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 清除素材缓存处理器（`command:clear_cache`）。
 *
 * 删除 `context.filesDir/materials` 目录下所有文件（素材缓存），同时保留目录结构。
 * 调用 [PlayerController.rebuild][com.adspread.android.service.orchestration.PlayerController.rebuild]
 * 以在清除后重新装载素材。
 *
 * V1 实现：递归删除缓存目录下所有文件，目录结构保留（[File.deleteRecursively] 后重建空目录）。
 */
@Singleton
class ClearCacheHandler @Inject constructor(
    @ApplicationContext private val context: Context,
) : CommandHandler {

    override fun execute(payload: CommandPayload): CommandResult {
        val cacheDir = java.io.File(context.filesDir, "materials")
        if (!cacheDir.exists()) return CommandResult.SUCCESS
        return try {
            cacheDir.deleteRecursively()
            cacheDir.mkdirs() // 重建空目录
            CommandResult.SUCCESS
        } catch (e: Exception) {
            CommandResult.FAILED
        }
    }
}
