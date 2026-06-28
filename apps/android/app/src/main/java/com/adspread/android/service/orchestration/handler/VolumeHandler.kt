package com.adspread.android.service.orchestration.handler

import android.content.Context
import android.media.AudioManager
import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 音量调节处理器（`command:volume`）。
 *
 * 将 [CommandPayload.Volume.level]（0~100）映射到系统 STREAM_MUSIC 音量范围后调用 [AudioManager.setStreamVolume]。
 * level 超出 [0, 100] 时 clamp 到合法区间。
 * V1 不携带 [AudioManager.FLAG_SHOW_UI] 以避免 UI 覆盖画面（静默调节）。
 */
@Singleton
class VolumeHandler @Inject constructor(
    @ApplicationContext private val context: Context,
) : CommandHandler {

    override fun execute(payload: CommandPayload): CommandResult {
        val level = (payload as CommandPayload.Volume).level
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        // level 0~100, scale to 0~maxVol
        val scaled = (level * maxVol / 100).coerceIn(0, maxVol)
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, scaled, 0) // no UI flag
        return CommandResult.SUCCESS
    }
}
