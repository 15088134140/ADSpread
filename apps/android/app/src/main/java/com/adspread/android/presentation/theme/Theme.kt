package com.adspread.android.presentation.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * ADSpread 主题（暗色为主，适合展示屏）。
 *
 * 门店展示端无人值守，交互极简。配色以低饱和度暗色为基底，内容区高亮呈现素材。
 * 暗色主题减少 OLED 功耗，适合长时间播放场景。
 */
private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF4FC3F7),        // 亮蓝：交互/选中态
    onPrimary = Color(0xFF003544),
    primaryContainer = Color(0xFF004D6E),
    onPrimaryContainer = Color(0xFFB3E5FC),

    secondary = Color(0xFF81C784),      // 柔绿：成功/就绪
    onSecondary = Color(0xFF00330D),
    secondaryContainer = Color(0xFF004D1A),
    onSecondaryContainer = Color(0xFFA5D6A7),

    tertiary = Color(0xFFFFB74D),       // 暖橙：警告
    onTertiary = Color(0xFF442B00),

    error = Color(0xFFEF5350),          // 红色：错误
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),

    background = Color(0xFF0F0F0F),     // 近黑背景
    onBackground = Color(0xFFE0E0E0),
    surface = Color(0xFF1A1A1A),        // 卡片/面板表面
    onSurface = Color(0xFFE0E0E0),
    surfaceVariant = Color(0xFF2C2C2C),
    onSurfaceVariant = Color(0xFFB0B0B0),

    outline = Color(0xFF444444),
    outlineVariant = Color(0xFF333333),
)

@Suppress("unused") // light theme 保留供未来扩展
private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF0277BD),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFB3E5FC),
    onPrimaryContainer = Color(0xFF001F33),

    secondary = Color(0xFF388E3C),
    onSecondary = Color.White,
    tertiary = Color(0xFFFF8F00),

    background = Color(0xFFF5F5F5),
    onBackground = Color(0xFF1C1B1F),
    surface = Color.White,
    onSurface = Color(0xFF1C1B1F),
)

/**
 * ADSpread 主题入口。默认暗色，支持动态切换。
 *
 * 无人值守展示端持续运行，暗色主题为常态。后续可通过 [isSystemInDarkTheme] 参数
 * 支持用户偏好覆盖（列后续）。
 */
@Composable
fun AdSpreadTheme(
    darkTheme: Boolean = true,
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        content = content,
    )
}
