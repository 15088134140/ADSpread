package com.adspread.android.service.orchestration.handler

import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult
import com.google.common.truth.Truth.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

/** [ScreenshotHandler] 单测：确认 handler 返回 SUCCESS（实际截图为 CommandRouterImpl 职责）。 */
class ScreenshotHandlerTest {

    private lateinit var handler: ScreenshotHandler

    @BeforeEach
    fun setup() {
        handler = ScreenshotHandler()
    }

    @Test
    fun `execute returns SUCCESS`() {
        val result = handler.execute(CommandPayload.Empty)
        assertThat(result).isEqualTo(CommandResult.SUCCESS)
    }
}
