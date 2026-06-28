package com.adspread.android.service

import android.app.Application
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import com.adspread.android.app.MainActivity
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowApplication

/**
 * [BootReceiver] Robolectric 单测（Task A9）。
 *
 * 验证：
 * - ACTION_BOOT_COMPLETED 收到后启动 [MainActivity]
 * - Intent extra [EXTRA_START_SERVICE] = true
 * - 其他 intent action 不触发启动
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class BootReceiverTest {

    @Test
    fun `boot completed starts MainActivity with startService extra`() {
        val context = ApplicationProvider.getApplicationContext<Application>()
        val receiver = BootReceiver()

        receiver.onReceive(context, Intent(Intent.ACTION_BOOT_COMPLETED))

        val shadowApp = Shadows.shadowOf(context) as ShadowApplication
        val startedIntent = shadowApp.nextStartedActivity
        assertThat(startedIntent).isNotNull()
        assertThat(startedIntent.component?.className).isEqualTo(MainActivity::class.java.name)
        assertThat(startedIntent.getBooleanExtra(BootReceiver.EXTRA_START_SERVICE, false)).isTrue()
    }

    @Test
    fun `non boot action does not start activity`() {
        val context = ApplicationProvider.getApplicationContext<Application>()
        val receiver = BootReceiver()

        // 其他广播（如 CONNECTIVITY_CHANGE 等效）不应触发启动
        receiver.onReceive(context, Intent("android.net.conn.CONNECTIVITY_CHANGE"))

        val shadowApp = Shadows.shadowOf(context) as ShadowApplication
        val startedIntent = shadowApp.nextStartedActivity
        assertThat(startedIntent).isNull()
    }
}
