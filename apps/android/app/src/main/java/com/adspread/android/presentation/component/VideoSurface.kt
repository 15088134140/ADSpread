package com.adspread.android.presentation.component

import android.view.SurfaceView
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.exoplayer.ExoPlayer

/**
 * ExoPlayer Surface 绑定组件（spec ADR-C / §11，Task A10）。
 *
 * 用 [AndroidView] 包装 [SurfaceView]，在组合时将 Surface 绑定到 [player]。
 * 生命周期由 Compose 管理：DisposableEffect 确保退出时解除绑定。
 *
 * 性能（spec §11）：
 * - ExoPlayer 实例由 [PlayerController][com.adspread.android.service.orchestration.PlayerController]
 *   常驻（不在此创建/释放），A10 仅绑 Surface
 * - crossfade ≤150ms 由画面切换时由 Compose 动画处理
 *
 * @param player 该视频区域对应的 ExoPlayer 实例（来自 [PlayerController.playerForRegion]）
 */
@Composable
fun VideoSurface(
    player: ExoPlayer,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val surfaceView = remember { SurfaceView(context) }

    // 绑定 Surface 到 Player
    DisposableEffect(player) {
        player.setVideoSurfaceView(surfaceView)

        onDispose {
            // 解除绑定（Player 实例本身由 PlayerController 管理，不在此 release）
            player.clearVideoSurfaceView(surfaceView)
        }
    }

    AndroidView(
        factory = { surfaceView },
        modifier = modifier,
    )
}
