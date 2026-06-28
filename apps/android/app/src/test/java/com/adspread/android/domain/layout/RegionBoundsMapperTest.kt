package com.adspread.android.domain.layout

import com.adspread.android.domain.model.RegionBounds
import com.adspread.android.domain.model.ScreenOrientation
import com.adspread.android.domain.model.SplitType
import com.google.common.truth.Truth.assertThat
import org.junit.jupiter.api.Test

/**
 * [RegionBoundsMapper] 全矩阵单测：SPLIT_1/2/3/3_1/4 × PORTRAIT/LANDSCAPE + SPLIT_ANY。
 *
 * 断言忠实移植 `apps/backend/src/common/utils/layout.ts` 的 `getRegionBounds`，
 * 含 SPLIT_3_1 B2 修正（左半屏满高 + 右半屏上下二分，非 33:67）。
 */
class RegionBoundsMapperTest {

    // ===== SPLIT_ANY =====

    @Test
    fun `SPLIT_ANY returns empty for landscape`() {
        assertThat(RegionBoundsMapper.getRegionBounds(ScreenOrientation.LANDSCAPE, SplitType.ANY)).isEmpty()
    }

    @Test
    fun `SPLIT_ANY returns empty for portrait`() {
        assertThat(RegionBoundsMapper.getRegionBounds(ScreenOrientation.PORTRAIT, SplitType.ANY)).isEmpty()
    }

    // ===== SPLIT_1 =====

    @Test
    fun `SPLIT_1 returns single full-screen region for landscape`() {
        val b = RegionBoundsMapper.getRegionBounds(ScreenOrientation.LANDSCAPE, SplitType.SPLIT_1)
        assertThat(b).hasSize(1)
        assertThat(b[0]).isEqualTo(RegionBounds("region1", 0.0, 0.0, 1.0, 1.0))
    }

    @Test
    fun `SPLIT_1 returns single full-screen region for portrait`() {
        val b = RegionBoundsMapper.getRegionBounds(ScreenOrientation.PORTRAIT, SplitType.SPLIT_1)
        assertThat(b).hasSize(1)
        assertThat(b[0]).isEqualTo(RegionBounds("region1", 0.0, 0.0, 1.0, 1.0))
    }

    // ===== SPLIT_2 =====

    @Test
    fun `SPLIT_2 portrait splits top-bottom`() {
        val b = RegionBoundsMapper.getRegionBounds(ScreenOrientation.PORTRAIT, SplitType.SPLIT_2)
        assertThat(b).hasSize(2)
        assertThat(b[0]).isEqualTo(RegionBounds("region1", 0.0, 0.0, 1.0, 0.5))
        assertThat(b[1]).isEqualTo(RegionBounds("region2", 0.0, 0.5, 1.0, 0.5))
    }

    @Test
    fun `SPLIT_2 landscape splits left-right`() {
        val b = RegionBoundsMapper.getRegionBounds(ScreenOrientation.LANDSCAPE, SplitType.SPLIT_2)
        assertThat(b).hasSize(2)
        assertThat(b[0]).isEqualTo(RegionBounds("region1", 0.0, 0.0, 0.5, 1.0))
        assertThat(b[1]).isEqualTo(RegionBounds("region2", 0.5, 0.0, 0.5, 1.0))
    }

    // ===== SPLIT_3 =====

    @Test
    fun `SPLIT_3 portrait splits three horizontal bands`() {
        val b = RegionBoundsMapper.getRegionBounds(ScreenOrientation.PORTRAIT, SplitType.SPLIT_3)
        assertThat(b).hasSize(3)
        assertThat(b[0]).isEqualTo(RegionBounds("region1", 0.0, 0.0, 1.0, 1.0 / 3))
        assertThat(b[1]).isEqualTo(RegionBounds("region2", 0.0, 1.0 / 3, 1.0, 1.0 / 3))
        assertThat(b[2]).isEqualTo(RegionBounds("region3", 0.0, 2.0 / 3, 1.0, 1.0 / 3))
    }

    @Test
    fun `SPLIT_3 landscape splits three vertical bands`() {
        val b = RegionBoundsMapper.getRegionBounds(ScreenOrientation.LANDSCAPE, SplitType.SPLIT_3)
        assertThat(b).hasSize(3)
        assertThat(b[0]).isEqualTo(RegionBounds("region1", 0.0, 0.0, 1.0 / 3, 1.0))
        assertThat(b[1]).isEqualTo(RegionBounds("region2", 1.0 / 3, 0.0, 1.0 / 3, 1.0))
        assertThat(b[2]).isEqualTo(RegionBounds("region3", 2.0 / 3, 0.0, 1.0 / 3, 1.0))
    }

    // ===== SPLIT_3_1（B2 修正：左半屏满高 + 右半屏上下二分，不区分方向） =====

    @Test
    fun `SPLIT_3_1 landscape is left-full plus right-top-bottom split`() {
        val b = RegionBoundsMapper.getRegionBounds(ScreenOrientation.LANDSCAPE, SplitType.SPLIT_3_1)
        assertThat(b).hasSize(3)
        // 左半屏满高
        assertThat(b[0]).isEqualTo(RegionBounds("region1", 0.0, 0.0, 0.5, 1.0))
        // 右上
        assertThat(b[1]).isEqualTo(RegionBounds("region2", 0.5, 0.0, 0.5, 0.5))
        // 右下
        assertThat(b[2]).isEqualTo(RegionBounds("region3", 0.5, 0.5, 0.5, 0.5))
    }

    @Test
    fun `SPLIT_3_1 portrait same as landscape (orientation-agnostic)`() {
        // B2: SPLIT_3_1 不区分方向，PORTRAIT 与 LANDSCAPE 一致（对齐 layout.ts）
        val portrait = RegionBoundsMapper.getRegionBounds(ScreenOrientation.PORTRAIT, SplitType.SPLIT_3_1)
        val landscape = RegionBoundsMapper.getRegionBounds(ScreenOrientation.LANDSCAPE, SplitType.SPLIT_3_1)
        assertThat(portrait).isEqualTo(landscape)
    }

    @Test
    fun `SPLIT_3_1 is NOT 33-67 split (B2 guard)`() {
        // 守卫 B2 修正：确保不是旧的 33%:67% 误解
        val b = RegionBoundsMapper.getRegionBounds(ScreenOrientation.LANDSCAPE, SplitType.SPLIT_3_1)
        assertThat(b[0].width).isEqualTo(0.5) // 左半屏 50%，非 33%
        assertThat(b[1].width).isEqualTo(0.5)
        assertThat(b[2].width).isEqualTo(0.5)
    }

    // ===== SPLIT_4 =====

    @Test
    fun `SPLIT_4 returns four quadrants for landscape`() {
        val b = RegionBoundsMapper.getRegionBounds(ScreenOrientation.LANDSCAPE, SplitType.SPLIT_4)
        assertThat(b).hasSize(4)
        assertThat(b[0]).isEqualTo(RegionBounds("region1", 0.0, 0.0, 0.5, 0.5))
        assertThat(b[1]).isEqualTo(RegionBounds("region2", 0.5, 0.0, 0.5, 0.5))
        assertThat(b[2]).isEqualTo(RegionBounds("region3", 0.0, 0.5, 0.5, 0.5))
        assertThat(b[3]).isEqualTo(RegionBounds("region4", 0.5, 0.5, 0.5, 0.5))
    }

    @Test
    fun `SPLIT_4 portrait same as landscape (orientation-agnostic)`() {
        val portrait = RegionBoundsMapper.getRegionBounds(ScreenOrientation.PORTRAIT, SplitType.SPLIT_4)
        val landscape = RegionBoundsMapper.getRegionBounds(ScreenOrientation.LANDSCAPE, SplitType.SPLIT_4)
        assertThat(portrait).isEqualTo(landscape)
    }

    // ===== PORTRAIT 支持集（business.constants PORTRAIT_SPLIT_TYPES = SPLIT_1/2/3） =====

    @Test
    fun `PORTRAIT supported split types return non-empty bounds`() {
        assertThat(RegionBoundsMapper.getRegionBounds(ScreenOrientation.PORTRAIT, SplitType.SPLIT_1)).hasSize(1)
        assertThat(RegionBoundsMapper.getRegionBounds(ScreenOrientation.PORTRAIT, SplitType.SPLIT_2)).hasSize(2)
        assertThat(RegionBoundsMapper.getRegionBounds(ScreenOrientation.PORTRAIT, SplitType.SPLIT_3)).hasSize(3)
    }

    // ===== region 索引连续性（守卫 ADR-D：按索引分配 regionN） =====

    @Test
    fun `regionIds are sequential region1 to regionN`() {
        for (split in listOf(
            SplitType.SPLIT_1, SplitType.SPLIT_2, SplitType.SPLIT_3,
            SplitType.SPLIT_3_1, SplitType.SPLIT_4,
        )) {
            val b = RegionBoundsMapper.getRegionBounds(ScreenOrientation.LANDSCAPE, split)
            b.forEachIndexed { i, bounds ->
                assertThat(bounds.regionId).isEqualTo("region${i + 1}")
            }
        }
    }

    @Test
    fun `all bounds across full matrix are within 0 to 1`() {
        for (orientation in ScreenOrientation.entries) {
            for (split in SplitType.entries) {
                RegionBoundsMapper.getRegionBounds(orientation, split).forEach { bounds ->
                    assertThat(bounds.x).isAtLeast(0.0)
                    assertThat(bounds.x).isAtMost(1.0)
                    assertThat(bounds.y).isAtLeast(0.0)
                    assertThat(bounds.y).isAtMost(1.0)
                    assertThat(bounds.width).isAtLeast(0.0)
                    assertThat(bounds.width).isAtMost(1.0)
                    assertThat(bounds.height).isAtLeast(0.0)
                    assertThat(bounds.height).isAtMost(1.0)
                }
            }
        }
    }

    @Test
    fun `SPLIT_3_1 region count is 3`() {
        assertThat(RegionBoundsMapper.getRegionBounds(ScreenOrientation.LANDSCAPE, SplitType.SPLIT_3_1)).hasSize(3)
    }
}
