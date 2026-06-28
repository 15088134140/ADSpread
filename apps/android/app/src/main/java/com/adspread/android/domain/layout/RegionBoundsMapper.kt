package com.adspread.android.domain.layout

import com.adspread.android.domain.model.RegionBounds
import com.adspread.android.domain.model.ScreenOrientation
import com.adspread.android.domain.model.SplitType

/**
 * 分屏区域边界映射器（忠实移植 `apps/backend/src/common/utils/layout.ts` 的 `getRegionBounds`）。
 *
 * 按 `(screenOrientation, splitType)` 返回有序 [RegionBounds] 列表，调用方按 region 索引
 * 取对应 bounds（守卫 ADR-D，spec §K9）。[SplitType.ANY] 返回空列表。
 *
 * 矩阵（与后端 `layout.ts` 完全一致）：
 * - SPLIT_1：单区域全屏
 * - SPLIT_2：竖屏上下二分 / 横屏（及 ANY 方向）左右二分
 * - SPLIT_3：竖屏上中下三分 / 横屏左中右三分
 * - SPLIT_3_1：左半屏满高 + 右半屏上下二分（B2 修正，**不区分方向**，非 33:67）
 * - SPLIT_4：四宫格（不区分方向）
 *
 * 非 PORTRAIT 方向（LANDSCAPE/ANY）统一走横屏布局，与后端
 * `screenOrientation === PORTRAIT ? portrait : landscape` 一致。
 */
object RegionBoundsMapper {

    fun getRegionBounds(
        screenOrientation: ScreenOrientation,
        splitType: SplitType,
    ): List<RegionBounds> = when (splitType) {
        SplitType.ANY -> emptyList()

        SplitType.SPLIT_1 -> listOf(
            RegionBounds("region1", 0.0, 0.0, 1.0, 1.0),
        )

        SplitType.SPLIT_2 -> when (screenOrientation) {
            ScreenOrientation.PORTRAIT -> listOf(
                RegionBounds("region1", 0.0, 0.0, 1.0, 0.5),
                RegionBounds("region2", 0.0, 0.5, 1.0, 0.5),
            )
            else -> listOf(
                RegionBounds("region1", 0.0, 0.0, 0.5, 1.0),
                RegionBounds("region2", 0.5, 0.0, 0.5, 1.0),
            )
        }

        SplitType.SPLIT_3 -> when (screenOrientation) {
            ScreenOrientation.PORTRAIT -> listOf(
                RegionBounds("region1", 0.0, 0.0, 1.0, 1.0 / 3),
                RegionBounds("region2", 0.0, 1.0 / 3, 1.0, 1.0 / 3),
                RegionBounds("region3", 0.0, 2.0 / 3, 1.0, 1.0 / 3),
            )
            else -> listOf(
                RegionBounds("region1", 0.0, 0.0, 1.0 / 3, 1.0),
                RegionBounds("region2", 1.0 / 3, 0.0, 1.0 / 3, 1.0),
                RegionBounds("region3", 2.0 / 3, 0.0, 1.0 / 3, 1.0),
            )
        }

        SplitType.SPLIT_3_1 -> listOf(
            RegionBounds("region1", 0.0, 0.0, 0.5, 1.0),
            RegionBounds("region2", 0.5, 0.0, 0.5, 0.5),
            RegionBounds("region3", 0.5, 0.5, 0.5, 0.5),
        )

        SplitType.SPLIT_4 -> listOf(
            RegionBounds("region1", 0.0, 0.0, 0.5, 0.5),
            RegionBounds("region2", 0.5, 0.0, 0.5, 0.5),
            RegionBounds("region3", 0.0, 0.5, 0.5, 0.5),
            RegionBounds("region4", 0.5, 0.5, 0.5, 0.5),
        )
    }
}
