package com.adspread.android.di

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionCommands
import com.adspread.android.domain.playback.DecodeTier
import com.adspread.android.domain.playback.VideoDecodePolicy
import com.adspread.android.domain.schedule.LocalScheduleEngine
import com.adspread.android.domain.schedule.TimeProvider
import com.adspread.android.service.orchestration.DecoderPool
import com.adspread.android.service.orchestration.MediaCodecDecoderPool
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * 播放引擎 Hilt 模块（spec §7.1 / K3 / K4，A6）。
 *
 * 提供：
 * - [DecoderPool]（[MediaCodecDecoderPool]）：ExoPlayer 工厂 + 硬解实例上限探测（K3）。
 * - [MediaSession.Callback]：K4 隐藏系统媒体控制器通知的会话回调（[HiddenMediaSessionCallback]）。
 *
 * **不提供 MediaSession/ExoPlayer 实例**：两者生命周期绑定 [com.adspread.android.service.PlayerService]
 * （前台 Service 启停），由 Service 在 `onStartCommand` 创建、`onDestroy` 释放，避免 Singleton 跨
 * Service 重建持有已释放实例。MediaSession 须有活跃 Player 才满足 mediaPlayback 类型（ADR-B）。
 */
@Module
@InstallIn(SingletonComponent::class)
object PlayerModule {

    @Provides
    @Singleton
    fun provideDecoderPool(@ApplicationContext context: Context): DecoderPool =
        MediaCodecDecoderPool(context)

    @Provides
    @Singleton
    fun provideMediaSessionCallback(): MediaSession.Callback = HiddenMediaSessionCallback

    @Provides
    @Singleton
    fun provideLocalScheduleEngine(timeProvider: TimeProvider): LocalScheduleEngine =
        LocalScheduleEngine(timeProvider)
}

/**
 * 最小 MediaSession 回调（ADR-B / K4）：显式隐藏系统媒体控制器通知，避免目标盒子 ROM 弹控制器遮挡画面。
 *
 * - 拒绝 media notification controller（media3 内部用于媒体通知的控制器）连接；
 * - 其余控制器接受但授予空命令（不暴露播放控制 UI）。
 *
 * **主隐藏机制**：session 绑定的 ExoPlayer 为空闲（无 media、未播放）实例，System UI 因无 playback
 * state/metadata 不显示媒体通知；本回调为防御纵深。
 *
 * **K4 风险（待真机验证，A11）**：目标盒子 ROM 可能无视拒绝仍弹控制器遮挡画面。真机验证若无法隐藏，
 * 评估降级 `foregroundServiceType="specialUse"`（spec ADR-B / 风险表）。模拟器无法验收此行为。
 */
@OptIn(UnstableApi::class)
object HiddenMediaSessionCallback : MediaSession.Callback {
    override fun onConnect(
        session: MediaSession,
        controller: MediaSession.ControllerInfo,
    ): MediaSession.ConnectionResult {
        if (session.isMediaNotificationController(controller)) {
            return MediaSession.ConnectionResult.reject()
        }
        return MediaSession.ConnectionResult.accept(SessionCommands.EMPTY, Player.Commands.EMPTY)
    }
}
