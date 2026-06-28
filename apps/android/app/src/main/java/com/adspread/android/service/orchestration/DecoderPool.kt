@file:OptIn(UnstableApi::class)

package com.adspread.android.service.orchestration

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.mediacodec.MediaCodecInfo
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector
import androidx.media3.exoplayer.mediacodec.MediaCodecUtil
import com.adspread.android.domain.playback.DecodeTier
import com.adspread.android.domain.playback.VideoDecodePolicy

/**
 * 中性解码器描述（剥离 Android `MediaCodecInfo`，便于纯 JVM 单测计数逻辑）。
 */
data class VideoCodecDescriptor(
    val name: String,
    val hardwareAccelerated: Boolean,
    val softwareOnly: Boolean,
)

/**
 * 统计硬解视频解码器数量（纯函数，便于单测）。
 *
 * 仅计 [VideoCodecDescriptor.hardwareAccelerated] 为 true 的解码器；按 [name] 去重
 * （同一硬件解码器可能对多 MIME 类型重复出现，避免重复计数）。
 */
fun countHardwareVideoDecoders(codecs: List<VideoCodecDescriptor>): Int =
    codecs.filter { it.hardwareAccelerated }.distinctBy { it.name }.size

/**
 * 解码器池端口（spec §11 / K3）：探测硬解实例上限 + 创建 ExoPlayer（按 [DecodeTier] 配置解码路径）。
 *
 * 探测与 ExoPlayer 创建依赖 Android `MediaCodecUtil`/`MediaCodec`，故在 service 层；阈值常量与决策在
 * [VideoDecodePolicy]（domain，纯 Kotlin）。单测通过 [countHardwareVideoDecoders] +
 * [VideoDecodePolicy.planDecodeTiers] 覆盖决策；实际 `MediaCodecUtil` 探测行为受 ROM 影响须真机验收（K8）。
 *
 * **ExoPlayer 创建线程约束**：[createPlayer] 必须在带 Looper 的线程（主线程）调用——
 * `ExoPlayer.Builder` 绑定调用线程 Looper。由 [PlayerService][com.adspread.android.service.PlayerService]
 * 在主线程构造，[PlayerController][com.adspread.android.service.orchestration.PlayerController] 在
 * `Dispatchers.Main` 调用。
 */
interface DecoderPool {
    /** 可用硬解视频解码器数（探测失败或 ≤0 回退 [VideoDecodePolicy.MAX_CONCURRENT_HARDWARE_DECODERS_DEFAULT]）。 */
    fun maxHardwareVideoDecoders(): Int

    /** 创建一个 ExoPlayer 实例（[DecodeTier.HARDWARE] 走默认硬解，[DecodeTier.SOFTWARE] 强制软解降级）。 */
    fun createPlayer(tier: DecodeTier): ExoPlayer
}

/**
 * 基于 `MediaCodecUtil` 的 [DecoderPool] 实现。
 *
 * - [maxHardwareVideoDecoders]：查询常见视频 MIME（H.264/H.265/MP4V）的解码器，统计硬解数，
 *   被 [defaultMax] 封顶（避免低端盒子超限，K3）。`MediaCodecUtil` 内部按 API 版本正确判定
 *   硬/软解（API 29+ 用 `CodecCapabilities.isHardwareAccelerated`，低版本用命名启发式）。
 * - [createPlayer]：[DecodeTier.SOFTWARE] 用 [SoftwareOnlyMediaCodecSelector] 过滤仅软解，实现强制软解降级；
 *   [DecodeTier.HARDWARE] 用默认选择器。两者均 `setEnableDecoderFallback(true)` 兜底。
 *
 * @param defaultMax 探测失败或 ≤0 时的回退上限
 */
class MediaCodecDecoderPool(
    private val context: Context,
    private val defaultMax: Int = VideoDecodePolicy.MAX_CONCURRENT_HARDWARE_DECODERS_DEFAULT,
) : DecoderPool {

    override fun maxHardwareVideoDecoders(): Int {
        val probed = runCatching { countHardwareVideoDecoders(queryVideoDecoders()) }.getOrDefault(0)
        return if (probed > 0) minOf(probed, defaultMax) else defaultMax
    }

    override fun createPlayer(tier: DecodeTier): ExoPlayer {
        val renderers = DefaultRenderersFactory(context)
            .setEnableDecoderFallback(true)
            .apply {
                if (tier == DecodeTier.SOFTWARE) {
                    setMediaCodecSelector(SoftwareOnlyMediaCodecSelector)
                }
            }
        return ExoPlayer.Builder(context, renderers).build()
    }

    /** 查询常见视频 MIME 的解码器（media3 MediaCodecUtil 按 API 版本正确判定硬/软解）。 */
    private fun queryVideoDecoders(): List<VideoCodecDescriptor> =
        VIDEO_MIME_TYPES.flatMap { mime ->
            runCatching { MediaCodecUtil.getDecoderInfos(mime, false, false) }
                .getOrDefault(emptyList())
        }.map { it.toDescriptor() }

    private fun MediaCodecInfo.toDescriptor(): VideoCodecDescriptor =
        VideoCodecDescriptor(name = name, hardwareAccelerated = hardwareAccelerated, softwareOnly = softwareOnly)

    private companion object {
        val VIDEO_MIME_TYPES = listOf("video/avc", "video/hevc", "video/mp4v-es")
    }
}

/**
 * 仅返回软解解码器的 [MediaCodecSelector]（K3 降级：硬解实例超限时对次要 region 强制软解）。
 *
 * 委托 [MediaCodecSelector.DEFAULT] 查询后过滤 `softwareOnly == true`；查询异常返回空列表
 * （由 `setEnableDecoderFallback` 兜底，避免无软解时构建失败）。
 */
private object SoftwareOnlyMediaCodecSelector : MediaCodecSelector {
    override fun getDecoderInfos(
        mimeType: String,
        requiresSecureDecoder: Boolean,
        requiresTunnelingDecoder: Boolean,
    ): List<MediaCodecInfo> = try {
        MediaCodecSelector.DEFAULT
            .getDecoderInfos(mimeType, requiresSecureDecoder, requiresTunnelingDecoder)
            .filter { it.softwareOnly }
    } catch (e: MediaCodecUtil.DecoderQueryException) {
        emptyList()
    }
}
