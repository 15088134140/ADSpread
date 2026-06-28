package com.adspread.android.service.orchestration.handler

import android.content.Context
import android.media.AudioManager
import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult
import com.google.common.truth.Truth.assertThat
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

/** [VolumeHandler] 单测：音量映射、clamp、AudioManager 调用验证。 */
class VolumeHandlerTest {

    private lateinit var context: Context
    private lateinit var audioManager: AudioManager
    private lateinit var handler: VolumeHandler

    @BeforeEach
    fun setup() {
        audioManager = mockk()
        context = mockk {
            every { getSystemService(Context.AUDIO_SERVICE) } returns audioManager
        }
        handler = VolumeHandler(context)
    }

    @Test
    fun `sets volume scaled to audio manager max`() {
        every { audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC) } returns 15
        val levelSlot = slot<Int>()
        every { audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, capture(levelSlot), 0) } returns Unit

        val result = handler.execute(CommandPayload.Volume(level = 50))

        assertThat(result).isEqualTo(CommandResult.SUCCESS)
        assertThat(levelSlot.captured).isEqualTo(7) // 50% of 15 = 7.5 → 7 (int)
    }

    @Test
    fun `clamps level to 0 at minimum`() {
        every { audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC) } returns 15
        val levelSlot = slot<Int>()
        every { audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, capture(levelSlot), 0) } returns Unit

        handler.execute(CommandPayload.Volume(level = -10))

        assertThat(levelSlot.captured).isEqualTo(0)
    }

    @Test
    fun `clamps level to max at 100 percent`() {
        every { audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC) } returns 15
        val levelSlot = slot<Int>()
        every { audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, capture(levelSlot), 0) } returns Unit

        handler.execute(CommandPayload.Volume(level = 200))

        assertThat(levelSlot.captured).isEqualTo(15)
    }

    @Test
    fun `sets max volume at 100 percent`() {
        every { audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC) } returns 10
        val levelSlot = slot<Int>()
        every { audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, capture(levelSlot), 0) } returns Unit

        handler.execute(CommandPayload.Volume(level = 100))

        assertThat(levelSlot.captured).isEqualTo(10)
    }
}
