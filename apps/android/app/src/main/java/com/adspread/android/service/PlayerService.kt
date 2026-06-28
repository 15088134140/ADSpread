package com.adspread.android.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.annotation.SuppressLint
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.adspread.android.app.MainActivity
import com.adspread.android.di.HiddenMediaSessionCallback
import com.adspread.android.domain.playback.DecodeTier
import com.adspread.android.service.orchestration.CommandRouterImpl
import com.adspread.android.service.orchestration.DecoderPool
import com.adspread.android.service.orchestration.HeartbeatLoop
import com.adspread.android.service.orchestration.PlayerController
import com.adspread.android.service.orchestration.ProgressReporter
import com.adspread.android.service.orchestration.Watchdog
import com.adspread.android.service.orchestration.buildHeartbeatReq
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import java.util.UUID
import javax.inject.Inject

/**
 * 前台播放编排 Service（spec §7.1 / ADR-B / ADR-E，A6）。
 *
 * `foregroundServiceType="mediaPlayback"`（targetSdk34 强制），持有最小 [MediaSession]（绑定空闲 ExoPlayer
 * 满足类型要求，ADR-B）+ 编排组件（[PlayerController] / [HeartbeatLoop] / [ProgressReporter] / [Watchdog]）。
 *
 * **单一前台编排模型**（ADR-E）：心跳/进度/看门狗由本 Service 内协程驱动（WorkManager 周期最小 15min
 * 无法承载 30s/10s/60s 高频）；节目同步与素材下载用 WorkManager 突发任务（A7）。
 *
 * **生命周期**：
 * - [onStartCommand]：startForeground（低优先级通知，无媒体控制器 UI，K4）→ 建 sessionPlayer + MediaSession →
 *   启动编排/心跳/进度/看门狗；
 * - [onDestroy]：反序释放（编排停 → MediaSession 释放 → sessionPlayer 释放 → scope 取消）。
 *
 * **MediaSession 隐藏（K4，待真机验证 A11）**：用 [HiddenMediaSessionCallback] 拒绝 media notification
 * controller + 空命令；sessionPlayer 空闲（无 media）使 System UI 不显示媒体通知。**风险**：目标盒子 ROM
 * 可能无视拒绝弹控制器遮挡画面，须真机验收；无法隐藏评估降级 `specialUse` 类型。
 *
 * **启动方**：本 Service 不自启；由 MainActivity（A10）/ BootReceiver（A9）以 `startForegroundService` 启动。
 */
@AndroidEntryPoint
class PlayerService : Service() {

    @Inject lateinit var playerController: PlayerController
    @Inject lateinit var heartbeatLoop: HeartbeatLoop
    @Inject lateinit var progressReporter: ProgressReporter
    @Inject lateinit var watchdog: Watchdog
    @Inject lateinit var decoderPool: DecoderPool
    @Inject lateinit var mediaSessionCallback: MediaSession.Callback
    @Inject lateinit var commandRouter: CommandRouterImpl

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var sessionPlayer: ExoPlayer? = null
    private var mediaSession: MediaSession? = null
    private var sessionId: String = ""
    private var started = false

    override fun onCreate() {
        super.onCreate()  // Hilt 注入触发
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        @SuppressLint("NewApi")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, buildNotification(), foregroundType())
        } else {
            @Suppress("DEPRECATION")
            startForeground(NOTIFICATION_ID, buildNotification())
        }

        if (started) return START_STICKY  // 幂等：多次启动不复建 MediaSession
        started = true

        sessionId = UUID.randomUUID().toString()

        // sessionPlayer：空闲 ExoPlayer，满足 mediaPlayback 类型（须有活跃 Player 绑定 MediaSession）
        sessionPlayer = decoderPool.createPlayer(DecodeTier.HARDWARE)
        mediaSession = MediaSession.Builder(this, sessionPlayer!!)
            .setId(sessionId)
            .setCallback(mediaSessionCallback)
            .build()

        // 编排协程（PlayerController 内部用 Dispatchers.Main，ExoPlayer 调用须主线程）
        playerController.start(serviceScope)
        // 心跳 60s（对齐 dashboard 5min 在线阈值）
        heartbeatLoop.start(serviceScope) { buildHeartbeatReq(playerController.state.value) }
        // 进度 10s → play_log；每 tick 喂看门狗（编排协程存活证明）
        progressReporter.start(
            scope = serviceScope,
            sessionId = sessionId,
            stateProvider = { playerController.state.value },
            onTick = { watchdog.feed() },
        )
        // 看门狗 30s 无心跳 → 软重启编排
        watchdog.start(serviceScope) { playerController.rebuild() }

        // 指令通道：订阅 WS/轮询指令并分发（A8 CommandRouter）
        commandRouter.startCollecting(serviceScope)

        return START_STICKY
    }

    override fun onDestroy() {
        playerController.stop()
        commandRouter.stopCollecting()
        mediaSession?.let { runCatching { it.release() } }
        mediaSession = null
        sessionPlayer?.let { runCatching { it.release() } }
        sessionPlayer = null
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null  // 非绑定 Service

    /** 低优先级通知（无媒体控制器 UI，K4）：仅标识前台播放服务运行中。 */
    private fun buildNotification(): Notification {
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(NOTIFICATION_TITLE)
            .setContentText(NOTIFICATION_TEXT)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setContentIntent(contentIntent)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_LOW,  // 低优先级，无声不弹横幅
        ).apply { setShowBadge(false) }
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(channel)
    }

    private fun foregroundType(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        } else {
            0  // <API 29 用 manifest 声明的类型
        }

    private companion object {
        const val NOTIFICATION_ID = 1001
        const val CHANNEL_ID = "player_service"
        const val CHANNEL_NAME = "ADSpread 播放服务"
        const val NOTIFICATION_TITLE = "ADSpread"
        const val NOTIFICATION_TEXT = "播放服务运行中"
    }
}
