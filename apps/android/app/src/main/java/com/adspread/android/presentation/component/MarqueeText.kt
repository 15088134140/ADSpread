package com.adspread.android.presentation.component

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

/**
 * 跑马灯文字组件（spec ADR-C / §14 诊断信息，Task A10）。
 *
 * 水平滚动文字，用于：
 * 1. 区域兜底占位（无素材或加载中时显示提示文字）
 * 2. 未来扩展的文字素材类型
 *
 * 动画：文字超出容器宽度时触发无限水平左移滚动，匀速循环。
 * 从右侧进入，完全移出后从右侧重新入画。
 *
 * @param text 显示文字
 * @param color 文字颜色，默认使用主题 [MaterialTheme.colorScheme.onSurface]
 * @param scanSpeedDpPerSec 滚动速度（dp/秒）
 * @param modifier Compose 修饰符
 */
@Composable
fun MarqueeText(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onSurface,
    scanSpeedDpPerSec: Int = MARQUEE_SPEED_DP_PER_SEC,
) {
    val density = LocalDensity.current
    var containerWidthPx by remember { mutableStateOf(0) }
    val estimatedTextWidthPx = remember(text) {
        (text.length * CHAR_WIDTH_ESTIMATE_DP * density.density).toInt()
    }
    val shouldScroll = containerWidthPx > 0 && estimatedTextWidthPx > containerWidthPx
    val totalDistance = estimatedTextWidthPx + containerWidthPx
    val scrollDurationMs = if (shouldScroll && totalDistance > 0) {
        (totalDistance / (scanSpeedDpPerSec * density.density / 1000f)).toInt().coerceAtLeast(1000)
    } else {
        0
    }

    // offset animation: scroll when text overflows, static 0f otherwise
    val animOffsetX: Float = if (shouldScroll && scrollDurationMs > 0) {
        val infiniteTransition = rememberInfiniteTransition(label = "marqueeTransition")
        val offsetState: State<Float> = infiniteTransition.animateFloat(
            initialValue = containerWidthPx.toFloat(),
            targetValue = (-estimatedTextWidthPx).toFloat(),
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = scrollDurationMs, easing = LinearEasing),
                repeatMode = RepeatMode.Restart,
            ),
            label = "marqueeOffset",
        )
        offsetState.value
    } else {
        0f
    }

    Box(
        modifier = modifier
            .clipToBounds()
            .onSizeChanged { containerWidthPx = it.width },
    ) {
        if (shouldScroll) {
            Text(
                text = text,
                style = MaterialTheme.typography.bodyLarge,
                color = color,
                maxLines = 1,
                softWrap = false,
                overflow = TextOverflow.Clip,
                modifier = Modifier
                    .width((estimatedTextWidthPx / density.density).dp)
                    .offset { IntOffset(animOffsetX.roundToInt(), 0) },
            )
        } else {
            Text(
                text = text,
                style = MaterialTheme.typography.bodyLarge,
                color = color,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.align(Alignment.Center),
            )
        }
    }
}

private const val MARQUEE_SPEED_DP_PER_SEC = 50
private const val CHAR_WIDTH_ESTIMATE_DP = 12
