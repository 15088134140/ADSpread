package com.adspread.android.presentation.component

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import java.io.File

/**
 * 图片轮播组件（spec ADR-C / §11，Task A10）。
 *
 * 用 Coil [AsyncImage] 加载本地图片文件，crossfade 动画过渡。
 *
 * 性能（spec §11）：
 * - Coil 内存缓存管控上限（约可用内存 1/8），磁盘缓存独立限额
 * - crossfade 启用（默认 100ms），切换 ≤150ms 目标
 * - 图片源为 [RegionPlaybackState.currentMaterialLocalPath]（本地 READY 素材）
 *
 * @param imagePath 本地图片文件路径（file:// URI 或绝对路径，Coil 自动识别）
 */
@Composable
fun ImageCarousel(
    imagePath: String,
    modifier: Modifier = Modifier,
    remoteUrl: String? = null,
) {
    if (!File(imagePath).exists()) {
        // 素材未下载：显示占位 + 本地路径 + 远程 URL（便于诊断网络资源是否可达）
        val info = buildString {
            append("素材加载中...\n本地: $imagePath")
            if (!remoteUrl.isNullOrEmpty()) {
                append("\n远程: $remoteUrl")
            }
        }
        Box(modifier = modifier.fillMaxSize().background(Color(0xFF222222)), contentAlignment = Alignment.Center) {
            Text(info, color = Color.White, modifier = Modifier.padding(16.dp))
        }
    } else {
        AsyncImage(
            model = imagePath,
            contentDescription = "图片素材",
            contentScale = ContentScale.Fit,
            modifier = modifier,
        )
    }
}
