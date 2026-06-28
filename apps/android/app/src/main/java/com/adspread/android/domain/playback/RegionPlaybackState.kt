package com.adspread.android.domain.playback

import com.adspread.android.domain.model.MaterialType

/**
 * 单个 region 的当前播放状态（spec §7.1，A6 `PlayerController` 暴露供 UI（A10）订阅）。
 *
 * 纯 Kotlin（无 Android/ExoPlayer 依赖）：
 * - 视频 region 的 ExoPlayer 实例由
 *   [com.adspread.android.service.orchestration.PlayerController.playerForRegion] 暴露供 A10 绑定 Surface；
 * - 本 state 仅承载 UI 渲染选择（VideoSurface vs ImageCarousel）与进度/心跳上报所需的逻辑状态。
 *
 * @param currentMaterialLocalPath 当前素材本地路径（READY 素材）：图片 region 供 A10 加载本地文件，
 *   视频 region 已由 ExoPlayer 装载（A10 经 [playerForRegion] 绑定 Surface，不直接读此路径）。
 *   素材未就绪时为 null（L5 降级，region 无可播项）。
 * @param decodeTier 视频 region 的解码层级（[DecodeTier]）；图片 region 为 null
 * @param startedAtMs 当前素材开始播放时刻（epoch millis），供 ProgressReporter 计算已播时长
 */
data class RegionPlaybackState(
    val regionId: String,
    val programId: Int,
    val currentIndex: Int,
    val currentMaterialId: Int?,
    val currentMaterialLocalPath: String?,
    val remoteFileUrl: String?,
    val materialType: MaterialType?,
    val playlistSize: Int,
    val decodeTier: DecodeTier?,
    val startedAtMs: Long,
)
