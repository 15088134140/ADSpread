package com.adspread.android.domain.model

/**
 * 分屏类型（对齐 Prisma `SplitType` 枚举 / `packages/api-contracts/device/types.ts`）。
 *
 * - [SPLIT_1] 单区域全屏
 * - [SPLIT_2] 二分屏（竖屏上下 / 横屏左右）
 * - [SPLIT_3] 三分屏（竖屏上中下 / 横屏左中右）
 * - [SPLIT_3_1] 左半屏满高 + 右半屏上下二分（B2 修正，非 33:67）
 * - [SPLIT_4] 四宫格
 * - [ANY] 任意（不强制分屏，[RegionBoundsMapper][com.adspread.android.domain.layout.RegionBoundsMapper] 返回空 bounds 列表）
 *
 * 注意：PORTRAIT 仅支持 SPLIT_1/2/3（`business.constants.ts` PORTRAIT_SPLIT_TYPES），
 * LANDSCAPE 支持 SPLIT_1/2/3/3_1/4。校验由 data/infra 层负责，domain mapper 只算 bounds。
 */
enum class SplitType {
    SPLIT_1, SPLIT_2, SPLIT_3, SPLIT_3_1, SPLIT_4, ANY;
}

/** 屏幕方向（对齐 Prisma `ScreenOrientation` 枚举）。 */
enum class ScreenOrientation {
    LANDSCAPE, PORTRAIT, ANY;
}

/**
 * 素材类型（对齐 Prisma `MaterialType` 枚举）。
 *
 * 决定 [com.adspread.android.domain.playback.PlaylistItem] 时长换算策略：
 * 图片按配置 duration，视频按素材自身 duration。
 */
enum class MaterialType {
    IMAGE, VIDEO;
}
