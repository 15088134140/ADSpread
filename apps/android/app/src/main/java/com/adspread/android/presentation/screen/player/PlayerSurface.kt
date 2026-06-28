package com.adspread.android.presentation.screen.player

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import android.content.Intent
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.core.content.ContextCompat
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.Measurable
import androidx.compose.ui.layout.MeasurePolicy
import androidx.compose.ui.layout.MeasureResult
import androidx.compose.ui.layout.MeasureScope
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.IntOffset
import androidx.hilt.navigation.compose.hiltViewModel
import com.adspread.android.presentation.component.RegionSlot

/**
 * 播放画面顶层容器（spec ADR-C 分屏渲染）。
 *
 * **分屏渲染实现**（ADR-C）：
 * - 顶层 BoxWithConstraints 取实际像素 W, H
 * - 每个 region：`Modifier.offset(x=bounds.x*W, y=bounds.y*H).size(width=bounds.width*W, height=bounds.height*H)`
 * - `key(regionId)` 控制重组范围
 * - bounds 由 [PlayerViewModel] 通过 [RegionBoundsMapper][com.adspread.android.domain.layout.RegionBoundsMapper]
 *   本地计算（ADR-D / K9），**不读**后端 bounds 字段
 *
 * @param onNavigateToDiagnostic 导航到诊断页的回调（由外部密码输入触发）
 */
@Composable
fun PlayerSurface(
    onNavigateToDiagnostic: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: PlayerViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    // 确保 PlayerService 已启动（BootReceiver 启动时自动，绑定流程需手动触发）
    LaunchedEffect(Unit) {
        val intent = Intent(context, com.adspread.android.service.PlayerService::class.java)
        ContextCompat.startForegroundService(context, intent)
    }

    if (uiState.isEmpty) {
        // 无活跃节目：显示占位背景（兜底播放或空状态）
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(Color(0xFF0F0F0F)),
        )
        return
    }

    BoxWithConstraints(
        modifier = modifier.fillMaxSize(),
    ) {
        // 像素尺寸（BoxWithConstraints 提供的是 dp，需转 px）
        val density = LocalDensity.current
        val screenWidthPx = with(density) { maxWidth.toPx() }
        val screenHeightPx = with(density) { maxHeight.toPx() }

        // 用 for 循环（而非 forEach）保持 @Composable 上下文
        for (regionUi in uiState.regions) {
            val bounds = regionUi.bounds
            val state = regionUi.playbackState

            // 计算像素偏移与尺寸
            val offsetX = remember(bounds.x, screenWidthPx) { (bounds.x * screenWidthPx).toInt() }
            val offsetY = remember(bounds.y, screenHeightPx) { (bounds.y * screenHeightPx).toInt() }
            val regionWidthPx = remember(bounds.width, screenWidthPx) { (bounds.width * screenWidthPx).toInt() }
            val regionHeightPx = remember(bounds.height, screenHeightPx) { (bounds.height * screenHeightPx).toInt() }

            // 用 key(regionId) 避免跨 region 重组
            androidx.compose.runtime.key(regionUi.regionId) {
                Box(
                    modifier = Modifier
                        .offset { IntOffset(offsetX, offsetY) }
                        .then(
                            Modifier.layout { measurable: Measurable, constraints: Constraints ->
                                val placeable = measurable.measure(
                                    constraints.copy(
                                        minWidth = regionWidthPx,
                                        maxWidth = regionWidthPx,
                                        minHeight = regionHeightPx,
                                        maxHeight = regionHeightPx,
                                    )
                                )
                                layout(placeable.width, placeable.height) {
                                    placeable.placeRelative(0, 0)
                                }
                            }
                        )
                        .background(Color.Black),
                ) {
                    RegionSlot(
                        playbackState = state,
                        playerProvider = { viewModel.playerForRegion(regionUi.regionId) },
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
        }
    }
}
