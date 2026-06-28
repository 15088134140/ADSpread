package com.adspread.android.domain.playback

import com.adspread.android.service.orchestration.VideoCodecDescriptor
import com.adspread.android.service.orchestration.countHardwareVideoDecoders
import com.google.common.truth.Truth.assertThat
import org.junit.jupiter.api.Test

/**
 * [VideoDecodePolicy] + [countHardwareVideoDecoders] 单测（spec §11 / K3）。
 *
 * 决策与计数均为纯函数（domain/service 纯 Kotlin，无 Android 依赖），JUnit5 直接驱动；
 * 实际 `MediaCodecUtil` 探测行为受 ROM 影响须真机验收（K8），不在此覆盖。
 */
class VideoDecodePolicyTest {

    // ===== planDecodeTiers =====

    @Test
    fun `first N video regions get HARDWARE, overflow gets SOFTWARE`() {
        val tiers = VideoDecodePolicy.planDecodeTiers(
            availableHardwareDecoders = 2,
            videoRegionIds = listOf("r1", "r2", "r3", "r4"),
        )
        assertThat(tiers).containsExactly("r1", DecodeTier.HARDWARE, "r2", DecodeTier.HARDWARE,
            "r3", DecodeTier.SOFTWARE, "r4", DecodeTier.SOFTWARE)
    }

    @Test
    fun `zero available decoders makes all SOFTWARE`() {
        val tiers = VideoDecodePolicy.planDecodeTiers(0, listOf("r1", "r2"))
        assertThat(tiers.values).containsExactly(DecodeTier.SOFTWARE, DecodeTier.SOFTWARE)
    }

    @Test
    fun `negative available decoders treated as zero`() {
        val tiers = VideoDecodePolicy.planDecodeTiers(-1, listOf("r1"))
        assertThat(tiers["r1"]).isEqualTo(DecodeTier.SOFTWARE)
    }

    @Test
    fun `available exceeds region count gives all HARDWARE`() {
        val tiers = VideoDecodePolicy.planDecodeTiers(5, listOf("r1"))
        assertThat(tiers["r1"]).isEqualTo(DecodeTier.HARDWARE)
    }

    @Test
    fun `empty video regions returns empty map`() {
        assertThat(VideoDecodePolicy.planDecodeTiers(2, emptyList())).isEmpty()
    }

    @Test
    fun `region order preserved for primary priority`() {
        // 主区域（靠前）优先硬解；溢出在后
        val tiers = VideoDecodePolicy.planDecodeTiers(1, listOf("r1", "r2", "r3"))
        assertThat(tiers["r1"]).isEqualTo(DecodeTier.HARDWARE)
        assertThat(tiers["r2"]).isEqualTo(DecodeTier.SOFTWARE)
        assertThat(tiers["r3"]).isEqualTo(DecodeTier.SOFTWARE)
    }

    // ===== countHardwareVideoDecoders =====

    @Test
    fun `counts distinct hardware decoders ignoring software`() {
        val codecs = listOf(
            VideoCodecDescriptor("OMX.h264", hardwareAccelerated = true, softwareOnly = false),
            VideoCodecDescriptor("OMX.hevc", hardwareAccelerated = true, softwareOnly = false),
            VideoCodecDescriptor("OMX.google.h264", hardwareAccelerated = false, softwareOnly = true),
        )
        assertThat(countHardwareVideoDecoders(codecs)).isEqualTo(2)
    }

    @Test
    fun `deduplicates by decoder name across MIME types`() {
        // 同一硬件解码器对 avc/hevc 重复出现，应去重为 1
        val codecs = listOf(
            VideoCodecDescriptor("OMX.h264", hardwareAccelerated = true, softwareOnly = false),
            VideoCodecDescriptor("OMX.h264", hardwareAccelerated = true, softwareOnly = false),
        )
        assertThat(countHardwareVideoDecoders(codecs)).isEqualTo(1)
    }

    @Test
    fun `no hardware decoders returns zero`() {
        val codecs = listOf(
            VideoCodecDescriptor("c2.android.h264", hardwareAccelerated = false, softwareOnly = true),
        )
        assertThat(countHardwareVideoDecoders(codecs)).isEqualTo(0)
    }

    @Test
    fun `empty codec list returns zero`() {
        assertThat(countHardwareVideoDecoders(emptyList())).isEqualTo(0)
    }
}
