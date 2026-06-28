package com.adspread.android.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.adspread.android.app.MainActivity

/**
 * 开机自启接收器（spec §12.1 / Task A9）。
 *
 * 监听 `android.intent.action.BOOT_COMPLETED`，启动 [MainActivity] 并附带
 * [EXTRA_START_SERVICE] 标志，由 Activity 在 `onCreate` 中随后启动 [PlayerService]。
 *
 * **Android 14 启动顺序**（targetSdk=34）：系统限制后台 Service 直接启动；
 * 先启动前台 Activity 获得临时前台特权，再由 Activity 调用 `startForegroundService`
 * 启动 [PlayerService]（plan A9 §3.2）。
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val activityIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra(EXTRA_START_SERVICE, true)
        }
        context.startActivity(activityIntent)
    }

    companion object {
        /** 传给 MainActivity 的标志：收到开机广播，启动后需开启 PlayerService。 */
        const val EXTRA_START_SERVICE = "extra_start_service_on_boot"
    }
}
