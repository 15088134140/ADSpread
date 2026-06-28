package com.adspread.android.domain.command

import com.google.common.truth.Truth.assertThat
import org.junit.jupiter.api.Test

/** [Command] 枚举单测：事件解析、supported 标记、UNSUPPORTED 集合、事件名唯一性。 */
class CommandTest {

    @Test
    fun `fromEvent resolves all supported command events`() {
        assertThat(Command.fromEvent("command:screenshot")).isEqualTo(Command.SCREENSHOT)
        assertThat(Command.fromEvent("command:volume")).isEqualTo(Command.VOLUME)
        assertThat(Command.fromEvent("command:brightness")).isEqualTo(Command.BRIGHTNESS)
        assertThat(Command.fromEvent("command:stop")).isEqualTo(Command.STOP)
        assertThat(Command.fromEvent("command:resume")).isEqualTo(Command.RESUME)
        assertThat(Command.fromEvent("command:reload")).isEqualTo(Command.RELOAD)
        assertThat(Command.fromEvent("command:clear_cache")).isEqualTo(Command.CLEAR_CACHE)
        assertThat(Command.fromEvent("command:fetch_logs")).isEqualTo(Command.FETCH_LOGS)
        assertThat(Command.fromEvent("command:restart_app")).isEqualTo(Command.RESTART_APP)
        assertThat(Command.fromEvent("command:update_config")).isEqualTo(Command.UPDATE_CONFIG)
        assertThat(Command.fromEvent("command:switch_program")).isEqualTo(Command.SWITCH_PROGRAM)
    }

    @Test
    fun `fromEvent resolves unsupported command events`() {
        assertThat(Command.fromEvent("command:restart_device")).isEqualTo(Command.RESTART_DEVICE)
        assertThat(Command.fromEvent("command:power_schedule")).isEqualTo(Command.POWER_SCHEDULE)
    }

    @Test
    fun `fromEvent returns null for unknown event`() {
        assertThat(Command.fromEvent("command:unknown")).isNull()
        assertThat(Command.fromEvent("ad:update")).isNull()
        assertThat(Command.fromEvent("")).isNull()
    }

    @Test
    fun `supported commands match spec section 6-2 set`() {
        val supported = Command.entries.filter { it.supported }
        assertThat(supported).containsExactly(
            Command.SCREENSHOT, Command.VOLUME, Command.BRIGHTNESS, Command.STOP,
            Command.RESUME, Command.RELOAD, Command.CLEAR_CACHE, Command.FETCH_LOGS,
            Command.RESTART_APP, Command.UPDATE_CONFIG, Command.SWITCH_PROGRAM,
        )
    }

    @Test
    fun `unsupported commands are restart_device and power_schedule (D1)`() {
        val unsupported = Command.entries.filter { !it.supported }
        assertThat(unsupported).containsExactly(Command.RESTART_DEVICE, Command.POWER_SCHEDULE)
    }

    @Test
    fun `each command event name is unique`() {
        val events = Command.entries.map { it.event }
        assertThat(events).containsNoDuplicates()
    }

    @Test
    fun `command count is 13 (11 supported + 2 unsupported)`() {
        assertThat(Command.entries).hasSize(13)
    }
}
