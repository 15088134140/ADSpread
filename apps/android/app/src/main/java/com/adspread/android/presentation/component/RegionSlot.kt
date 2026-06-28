package com.adspread.android.presentation.component

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.media3.exoplayer.ExoPlayer
import com.adspread.android.domain.model.MaterialType
import com.adspread.android.domain.playback.RegionPlaybackState

/**
 * 区域插槽：按素材类型路由到对应渲染组件（spec ADR-C，Task A10）。
 *
 * 路由规则：
 * - [MaterialType.VIDEO] → [VideoSurface]（ExoPlayer Surface 绑定）
 * - [MaterialType.IMAGE] → [ImageCarousel]（Coil crossfade 轮播）
 * - null/未知 → [MarqueeText] 降级显示素材信息
 *
 * @param playbackState 该区域的当前播放状态；null 表示无活跃素材
 * @param playerProvider 返回该区域的 ExoPlayer 实例（仅视频 region 非 null）
 */
@Composable
fun RegionSlot(
    playbackState: RegionPlaybackState?,
    playerProvider: () -> ExoPlayer?,
    modifier: Modifier = Modifier,
) {
    val state = playbackState

    Box(modifier = modifier) {
        when (state?.materialType) {
            MaterialType.VIDEO -> {
                val player = playerProvider()
                if (player != null) {
                    VideoSurface(
                        player = player,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    // 视频 region 但 ExoPlayer 未就绪（降级）
                    MarqueeText(
                        text = "视频加载中...",
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
            MaterialType.IMAGE -> {
                val localPath = state.currentMaterialLocalPath
                if (localPath != null) {
                    ImageCarousel(
                        imagePath = localPath,
                        modifier = Modifier.fillMaxSize(),
                        remoteUrl = state.remoteFileUrl,
                    )
                } else {
                    MarqueeText(
                        text = "图片加载中...",
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
            null -> {
                // 无播放状态：空区域或兜底
                MarqueeText(
                    text = "无内容",
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
    }
}
