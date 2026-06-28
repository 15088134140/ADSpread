package com.adspread.android.service.orchestration.handler

import android.content.Context
import android.provider.Settings
import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult
import com.google.common.truth.Truth.assertThat
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.slot
import io.mockk.unmockkStatic
import io.mockk.verify
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

/** [BrightnessHandler] 单测：亮度映射、clamp、SecurityException 处理。 */
class BrightnessHandlerTest {

    private lateinit var context: Context
    private lateinit var handler: BrightnessHandler
    private val contentResolver = mockk<android.content.ContentResolver>()

    @BeforeEach
    fun setup() {
        context = mockk {
            every { contentResolver } returns this@BrightnessHandlerTest.contentResolver
        }
        handler = BrightnessHandler(context)
        mockkStatic(Settings.System::class)
    }

    @AfterEach
    fun teardown() {
        unmockkStatic(Settings.System::class)
    }

    @Test
    fun `sets brightness scaled to 0-255 range`() {
        val brightnessSlot = slot<Int>()
        every {
            Settings.System.putInt(any(), Settings.System.SCREEN_BRIGHTNESS, capture(brightnessSlot))
        } returns true

        val result = handler.execute(CommandPayload.Brightness(level = 0.5))

        assertThat(result).isEqualTo(CommandResult.SUCCESS)
        // 0.5 * 255 = 127.5 → 127 (int)
        assertThat(brightnessSlot.captured).isEqualTo(127)
    }

    @Test
    fun `clamps brightness at 0`() {
        val brightnessSlot = slot<Int>()
        every {
            Settings.System.putInt(any(), Settings.System.SCREEN_BRIGHTNESS, capture(brightnessSlot))
        } returns true

        handler.execute(CommandPayload.Brightness(level = -0.1))

        assertThat(brightnessSlot.captured).isEqualTo(0)
    }

    @Test
    fun `clamps brightness at 255`() {
        val brightnessSlot = slot<Int>()
        every {
            Settings.System.putInt(any(), Settings.System.SCREEN_BRIGHTNESS, capture(brightnessSlot))
        } returns true

        handler.execute(CommandPayload.Brightness(level = 2.0))

        assertThat(brightnessSlot.captured).isEqualTo(255)
    }

    @Test
    fun `returns FAILED on SecurityException`() {
        every {
            Settings.System.putInt(any(), Settings.System.SCREEN_BRIGHTNESS, any())
        } throws SecurityException("No WRITE_SETTINGS")

        val result = handler.execute(CommandPayload.Brightness(level = 0.3))

        assertThat(result).isEqualTo(CommandResult.FAILED)
    }

    @Test
    fun `full brightness maps to 255`() {
        val brightnessSlot = slot<Int>()
        every {
            Settings.System.putInt(any(), Settings.System.SCREEN_BRIGHTNESS, capture(brightnessSlot))
        } returns true

        handler.execute(CommandPayload.Brightness(level = 1.0))

        assertThat(brightnessSlot.captured).isEqualTo(255)
    }

    @Test
    fun `zero brightness maps to 0`() {
        val brightnessSlot = slot<Int>()
        every {
            Settings.System.putInt(any(), Settings.System.SCREEN_BRIGHTNESS, capture(brightnessSlot))
        } returns true

        handler.execute(CommandPayload.Brightness(level = 0.0))

        assertThat(brightnessSlot.captured).isEqualTo(0)
    }
}
