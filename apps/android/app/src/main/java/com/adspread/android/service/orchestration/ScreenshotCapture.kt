package com.adspread.android.service.orchestration

import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 屏幕截图捕获器（spec §6.2 `command:screenshot`，A8）。
 *
 * 通过 [View.draw][android.view.View.draw] 捕获当前 Activity 的 DecorView 内容，
 * 保存为 PNG 临时文件，返回文件绝对路径（由调用方上传或回传 URL）。
 *
 * **V1 实现**：使用 [View.draw] + [Canvas] + [Bitmap] 方案（兼容性好，不依赖 PixelCopy 硬件加速），
 * 直接截取 DecorView 渲染内容。画面质量和性能足够 V1 远程诊断用途。
 *
 * **临时文件管理**：每次截图生成新文件（UUID 命名）；由 `temp` 目录的 TTL 清理策略覆盖
 * （K5 素材缓存策略），V1 暂不做主动清理。
 */
@Singleton
class ScreenshotCapture @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    /** 截图保存目录（`filesDir/temp/screenshots/`）。 */
    private val screenshotsDir: File = File(context.filesDir, "temp/screenshots").also { it.mkdirs() }

    /**
     * 捕获当前 Activity 窗口截图，保存为 PNG，返回文件路径。失败返回 null。
     *
     * @param activity 当前前台 Activity（由 [ActivityRefProvider] 或调用方传入）
     */
    fun capture(activity: Activity?): String? {
        if (activity == null) return null
        return try {
            val decorView = activity.window.decorView
            val width = decorView.width.coerceAtLeast(1)
            val height = decorView.height.coerceAtLeast(1)
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            decorView.draw(canvas)
            saveBitmap(bitmap)
        } catch (e: Exception) {
            null
        }
    }

    /** 将 Bitmap 保存为 PNG 文件，返回文件绝对路径。 */
    private fun saveBitmap(bitmap: Bitmap): String {
        val file = File(screenshotsDir, "${UUID.randomUUID()}.png")
        FileOutputStream(file).use { out ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
        }
        bitmap.recycle()
        return file.absolutePath
    }
}
