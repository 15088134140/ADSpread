package com.adspread.android.service.orchestration.handler

import android.content.Context
import android.provider.Settings
import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 亮度调节处理器（`command:brightness`）。
 *
 * 将 [CommandPayload.Brightness.level]（0.0~1.0）映射到 [Settings.System.SCREEN_BRIGHTNESS]（0~255）。
 *
 * **权限**：写入 SCREEN_BRIGHTNESS 需 `android.permission.WRITE_SETTINGS`。
 * V1 目标设备为门店专用盒子，可预装授予此权限；若未授予则捕获 [SecurityException] 返回 [CommandResult.FAILED]。
 *
 * **替代方案**：Window-based brightness（[WindowManager.LayoutParams.screenBrightness]）不需要 WRITE_SETTINGS
 * 但绑定 Activity 生命周期 —— 留待后续（A11 真机验证时根据可用性切换）。
 */
@Singleton
class BrightnessHandler @Inject constructor(
    @ApplicationContext private val context: Context,
) : CommandHandler {

    override fun execute(payload: CommandPayload): CommandResult {
        val level = (payload as CommandPayload.Brightness).level
        val brightness = (level * 255).toInt().coerceIn(0, 255)
        return try {
            Settings.System.putInt(
                context.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS,
                brightness,
            )
            CommandResult.SUCCESS
        } catch (e: SecurityException) {
            CommandResult.FAILED
        }
    }
}
