package com.adspread.android.app

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * [CrashHandler] Robolectric 单测（Task A9）。
 *
 * 验证：
 * - 连续崩溃计数递增
 * - 超过阈值 [CrashHandler.MAX_CRASH_BEFORE_SAFE] 进入安全模式
 * - [onNormalStartup] 重置计数和安全模式标志
 * - 崩溃记录 JSON 文件写入与读取
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class CrashHandlerTest {

    @Before
    fun setup() {
        val context = ApplicationProvider.getApplicationContext<Application>()
        // Robolectric 在同一测试类中复用 Application，需先清空残留状态
        CrashHandler.resetForTesting(context)
        CrashHandler.install(context)
    }

    @After
    fun teardown() {
        CrashHandler.onNormalStartup()
        CrashHandler.clearCrashFiles()
    }

    @Test
    fun `single crash increments counter to 1`() {
        simulateCrash()

        assertThat(CrashHandler.getCrashCount()).isEqualTo(1)
    }

    @Test
    fun `multiple crashes increment counter cumulatively`() {
        simulateCrash()
        simulateCrash()

        assertThat(CrashHandler.getCrashCount()).isEqualTo(2)
    }

    @Test
    fun `crash below threshold does not activate safe mode`() {
        repeat(3) { simulateCrash() }

        assertThat(CrashHandler.getCrashCount()).isEqualTo(3)
        assertThat(CrashHandler.isSafeMode()).isFalse()
    }

    @Test
    fun `crash exceeding threshold activates safe mode`() {
        repeat(4) { simulateCrash() }

        assertThat(CrashHandler.getCrashCount()).isEqualTo(4)
        assertThat(CrashHandler.isSafeMode()).isTrue()
    }

    @Test
    fun `onNormalStartup resets crash count`() {
        repeat(2) { simulateCrash() }
        assertThat(CrashHandler.getCrashCount()).isEqualTo(2)

        CrashHandler.onNormalStartup()

        assertThat(CrashHandler.getCrashCount()).isEqualTo(0)
    }

    @Test
    fun `onNormalStartup clears safe mode`() {
        repeat(4) { simulateCrash() }
        assertThat(CrashHandler.isSafeMode()).isTrue()

        CrashHandler.onNormalStartup()

        assertThat(CrashHandler.isSafeMode()).isFalse()
    }

    @Test
    fun `crash writes crash record file`() {
        val message = "test crash record file"
        simulateCrash(RuntimeException(message))

        val records = CrashHandler.getPendingCrashRecords()
        assertThat(records).isNotEmpty()
        assertThat(records.first().message).contains(message)
        assertThat(records.first().exceptionType).contains("RuntimeException")
    }

    @Test
    fun `clearCrashFiles removes pending records`() {
        simulateCrash()
        assertThat(CrashHandler.getPendingCrashRecords()).isNotEmpty()

        CrashHandler.clearCrashFiles()

        assertThat(CrashHandler.getPendingCrashRecords()).isEmpty()
    }

    // ===== helpers =====

    private fun simulateCrash(throwable: Throwable = RuntimeException("test crash")) {
        val handler = Thread.getDefaultUncaughtExceptionHandler() as? CrashHandler
            ?: throw IllegalStateException("CrashHandler not installed")
        handler.uncaughtException(Thread.currentThread(), throwable)
    }
}
