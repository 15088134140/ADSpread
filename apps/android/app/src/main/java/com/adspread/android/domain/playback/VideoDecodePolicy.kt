package com.adspread.android.domain.playback

/**
 * 视频解码层级（spec §11 / K3 多路视频硬解降级）。
 *
 * - [HARDWARE]：MediaCodec 硬解路径（CPU 低，常态首选）。
 * - [SOFTWARE]：软解降级（硬解实例超限时对次要 region 使用，CPU 升高但避免解码器分配失败）。
 *
 * 决策由 [VideoDecodePolicy.planDecodeTiers] 给出；探测逻辑在 service 层
 * [com.adspread.android.service.orchestration.DecoderPool]，保持 domain 无 Android 依赖（K2）。
 */
enum class DecodeTier {
    HARDWARE,
    SOFTWARE,
}

/**
 * 多路视频硬解降级策略常量 + 决策（spec §11 / K3，纯 Kotlin 便于单测）。
 *
 * 探测逻辑（MediaCodecUtil/MediaCodecList）在 service 层
 * [com.adspread.android.service.orchestration.DecoderPool]；本对象仅持阈值常量与纯决策函数，
 * 保持 domain 无 Android 依赖（K2 分层守卫）。
 */
object VideoDecodePolicy {

    /**
     * 低端盒子保守默认硬解并发上限（spec §11 假设"1 视频 + N 图片/文字"为常态）。
     *
     * 探测失败或 ≤0 时回退此值；真机若支持更多可由 [com.adspread.android.service.orchestration.DecoderPool]
     * 探测上调，但被本常量封顶以避免低端盒子超限（K3 风险）。
     */
    const val MAX_CONCURRENT_HARDWARE_DECODERS_DEFAULT = 2

    /** 区域切换 crossfade 上限（spec §11 ≤150ms）。视觉 crossfade 由 UI 层（A10）实现。 */
    const val CROSSFADE_MAX_MS = 150L

    /**
     * 决策各视频 region 的解码层级：前 [availableHardwareDecoders] 个 region 走硬解，溢出走软解。
     *
     * 主区域（region 顺序靠前）优先硬解；次要 region 降级软解（K3）。region 顺序取自节目
     * `layoutConfig.regions`（[com.adspread.android.domain.layout.RegionBoundsMapper] 同序）。
     *
     * @param availableHardwareDecoders 探测到的可用硬解实例数（≤0 时全部软解）
     * @param videoRegionIds 视频区域 id 列表（按 region 顺序，主区域优先硬解）
     * @return regionId → 解码层级
     */
    fun planDecodeTiers(
        availableHardwareDecoders: Int,
        videoRegionIds: List<String>,
    ): Map<String, DecodeTier> {
        val hwSlots = availableHardwareDecoders.coerceAtLeast(0)
        return videoRegionIds.withIndex().associate { (index, regionId) ->
            regionId to if (index < hwSlots) DecodeTier.HARDWARE else DecodeTier.SOFTWARE
        }
    }
}
