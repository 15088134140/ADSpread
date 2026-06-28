package com.adspread.android.service.orchestration

import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.data.remote.socket.IncomingSocketEvent
import com.adspread.android.data.remote.socket.SocketIoClient
import com.adspread.android.domain.command.Command
import com.adspread.android.domain.command.CommandResult
import com.adspread.android.service.orchestration.handler.CommandHandler
import com.google.common.truth.Truth.assertThat
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

/** [CommandRouterImpl] 单测：指令路由、ack 回传、UNSUPPORTED 处理、异常安全。 */
class CommandRouterImplTest {

    private lateinit var socketIoClient: SocketIoClient
    private lateinit var screenshotCapture: ScreenshotCapture
    private lateinit var mockHandler: CommandHandler
    private lateinit var router: CommandRouterImpl
    private val incomingEvents = MutableSharedFlow<IncomingSocketEvent>(extraBufferCapacity = 16)

    @BeforeEach
    fun setup() {
        mockHandler = mockk()
        screenshotCapture = mockk()
        every { screenshotCapture.capture(any()) } returns null

        socketIoClient = mockk(relaxUnitFun = true)
        every { socketIoClient.incomingEvents } returns incomingEvents
    }

    @Test
    fun `dispatch returns UNSUPPORTED for unsupported commands`() {
        router = CommandRouterImpl(socketIoClient, screenshotCapture, emptyMap())

        assertThat(router.dispatch(Command.RESTART_DEVICE)).isEqualTo(CommandResult.UNSUPPORTED)
        assertThat(router.dispatch(Command.POWER_SCHEDULE)).isEqualTo(CommandResult.UNSUPPORTED)
    }

    @Test
    fun `dispatch returns FAILED when no handler registered`() {
        router = CommandRouterImpl(socketIoClient, screenshotCapture, emptyMap())

        assertThat(router.dispatch(Command.VOLUME)).isEqualTo(CommandResult.FAILED)
    }

    @Test
    fun `dispatch returns handler result for supported command`() {
        every { mockHandler.execute(any<CommandPayload>()) } returns CommandResult.SUCCESS
        val handlerMap = mapOf(Command.VOLUME to mockHandler)
        router = CommandRouterImpl(socketIoClient, screenshotCapture, handlerMap)

        assertThat(router.dispatch(Command.VOLUME)).isEqualTo(CommandResult.SUCCESS)
    }

    @Test
    fun `dispatch returns FAILED when handler throws`() {
        every { mockHandler.execute(any<CommandPayload>()) } throws RuntimeException("handler failed")
        val handlerMap = mapOf(Command.RESUME to mockHandler)
        router = CommandRouterImpl(socketIoClient, screenshotCapture, handlerMap)

        assertThat(router.dispatch(Command.RESUME)).isEqualTo(CommandResult.FAILED)
    }

    @Test
    fun `startCollecting routes command event to handler and sends ack`() = runTest {
        every { mockHandler.execute(any<CommandPayload>()) } returns CommandResult.SUCCESS
        val handlerMap = mapOf(Command.STOP to mockHandler)
        router = CommandRouterImpl(socketIoClient, screenshotCapture, handlerMap)

        val scope = CoroutineScope(Dispatchers.Unconfined)
        router.startCollecting(scope)

        incomingEvents.emit(
            IncomingSocketEvent.CommandEvent(
                command = Command.STOP,
                commandId = "cmd-1",
                payload = CommandPayload.Empty,
            )
        )

        verify(exactly = 1) { mockHandler.execute(CommandPayload.Empty) }
        verify(exactly = 1) {
            socketIoClient.sendAck(
                commandId = "cmd-1",
                result = CommandResult.SUCCESS,
                error = null,
                screenshotUrl = null,
            )
        }

        router.stopCollecting()
    }

    @Test
    fun `unsupported command event sends UNSUPPORTED ack without calling handler`() = runTest {
        val handlerMap = mapOf(Command.VOLUME to mockHandler)
        router = CommandRouterImpl(socketIoClient, screenshotCapture, handlerMap)

        val scope = CoroutineScope(Dispatchers.Unconfined)
        router.startCollecting(scope)

        incomingEvents.emit(
            IncomingSocketEvent.CommandEvent(
                command = Command.RESTART_DEVICE,
                commandId = "cmd-2",
                payload = CommandPayload.Empty,
            )
        )

        verify(exactly = 0) { mockHandler.execute(any()) }
        verify(exactly = 1) {
            socketIoClient.sendAck(
                commandId = "cmd-2",
                result = CommandResult.UNSUPPORTED,
                error = null,
                screenshotUrl = null,
            )
        }

        router.stopCollecting()
    }

    @Test
    fun `handler exception results in FAILED ack`() = runTest {
        every { mockHandler.execute(any<CommandPayload>()) } throws RuntimeException("boom")
        val handlerMap = mapOf(Command.SWITCH_PROGRAM to mockHandler)
        router = CommandRouterImpl(socketIoClient, screenshotCapture, handlerMap)

        val scope = CoroutineScope(Dispatchers.Unconfined)
        router.startCollecting(scope)

        incomingEvents.emit(
            IncomingSocketEvent.CommandEvent(
                command = Command.SWITCH_PROGRAM,
                commandId = "cmd-3",
                payload = CommandPayload.Empty,
            )
        )

        verify(exactly = 1) {
            socketIoClient.sendAck(
                commandId = "cmd-3",
                result = CommandResult.FAILED,
                error = "Handler execution failed",
                screenshotUrl = null,
            )
        }

        router.stopCollecting()
    }

    @Test
    fun `screenshot command executes handler and sends ack`() = runTest {
        every { mockHandler.execute(any<CommandPayload>()) } returns CommandResult.SUCCESS
        val handlerMap = mapOf(Command.SCREENSHOT to mockHandler)
        router = CommandRouterImpl(socketIoClient, screenshotCapture, handlerMap)

        val scope = CoroutineScope(Dispatchers.Unconfined)
        router.startCollecting(scope)

        incomingEvents.emit(
            IncomingSocketEvent.CommandEvent(
                command = Command.SCREENSHOT,
                commandId = "cmd-shot-1",
                payload = CommandPayload.Empty,
            )
        )

        verify(exactly = 1) { mockHandler.execute(CommandPayload.Empty) }
        // screenshotUrl is null because ActivityRefProvider.currentActivity is null in test
        verify(exactly = 1) {
            socketIoClient.sendAck(
                commandId = "cmd-shot-1",
                result = CommandResult.SUCCESS,
                error = null,
                screenshotUrl = null,
            )
        }

        router.stopCollecting()
    }
}
