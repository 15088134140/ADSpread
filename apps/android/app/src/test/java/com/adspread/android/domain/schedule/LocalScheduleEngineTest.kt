package com.adspread.android.domain.schedule

import com.adspread.android.domain.model.DeviceIdentity
import com.adspread.android.domain.model.PublishPlan
import com.google.common.truth.Truth.assertThat
import org.junit.jupiter.api.Test
import java.time.Instant

/**
 * [LocalScheduleEngine] 单测：星期/有效期/门店过滤边界（含跨周周日=7、endTime 边界、
 * storeId=null 返回 null、多计划取 createdAt desc 首位）。
 *
 * 时间锚点（Asia/Shanghai = UTC+8）：
 * - 2026-06-26T02:00Z = 周五 10:00（dayOfWeek=5）
 * - 2026-06-28T02:00Z = 周日 10:00（dayOfWeek=7）
 */
class LocalScheduleEngineTest {

    private val fridayUtc = Instant.parse("2026-06-26T02:00:00Z") // 周五 Shanghai 10:00
    private val engine = LocalScheduleEngine(TimeProvider { fridayUtc })

    private val device = DeviceIdentity(id = 1, code = "DEV001", storeId = 10)

    private fun plan(
        id: Int = 1,
        programId: Int = 100,
        targetStoreIds: List<Int> = listOf(10),
        startTime: Instant = fridayUtc.minusSeconds(3600),
        endTime: Instant? = fridayUtc.plusSeconds(3600),
        playDays: List<Int> = listOf(1, 2, 3, 4, 5, 6, 7),
        status: Int = 1,
        createdAt: Instant = fridayUtc.minusSeconds(7200),
    ) = PublishPlan(id, programId, targetStoreIds, startTime, endTime, playDays, status, createdAt)

    // ===== 未绑定门店 =====

    @Test
    fun `unbound device storeId null returns null`() {
        val unbound = device.copy(storeId = null)
        assertThat(engine.resolveCurrentProgramId(listOf(plan()), unbound)).isNull()
    }

    // ===== 正常匹配 =====

    @Test
    fun `matching plan returns its programId`() {
        assertThat(engine.resolveCurrentProgramId(listOf(plan(programId = 100)), device)).isEqualTo(100)
    }

    // ===== status 过滤 =====

    @Test
    fun `disabled status plan is filtered`() {
        assertThat(engine.resolveCurrentProgramId(listOf(plan(status = 0)), device)).isNull()
    }

    // ===== 有效期边界 =====

    @Test
    fun `future startTime plan is filtered`() {
        assertThat(engine.resolveCurrentProgramId(listOf(plan(startTime = fridayUtc.plusSeconds(3600))), device)).isNull()
    }

    @Test
    fun `startTime equals now is included (boundary)`() {
        assertThat(engine.resolveCurrentProgramId(listOf(plan(startTime = fridayUtc)), device)).isEqualTo(100)
    }

    @Test
    fun `expired endTime plan is filtered`() {
        assertThat(engine.resolveCurrentProgramId(listOf(plan(endTime = fridayUtc.minusSeconds(1))), device)).isNull()
    }

    @Test
    fun `endTime equals now is included (boundary)`() {
        assertThat(engine.resolveCurrentProgramId(listOf(plan(endTime = fridayUtc)), device)).isEqualTo(100)
    }

    @Test
    fun `null endTime plan is included`() {
        assertThat(engine.resolveCurrentProgramId(listOf(plan(endTime = null)), device)).isEqualTo(100)
    }

    // ===== 星期过滤（含跨周周日=7） =====

    @Test
    fun `playDays not containing today is filtered`() {
        // 今日周五=5，playDays 不含 5
        assertThat(engine.resolveCurrentProgramId(listOf(plan(playDays = listOf(1, 2, 3, 4, 6, 7))), device)).isNull()
    }

    @Test
    fun `playDays containing today is included`() {
        assertThat(engine.resolveCurrentProgramId(listOf(plan(playDays = listOf(5))), device)).isEqualTo(100)
    }

    @Test
    fun `sunday maps to 7 (cross-week boundary)`() {
        val sundayUtc = Instant.parse("2026-06-28T02:00:00Z") // 周日 Shanghai 10:00
        val sunEngine = LocalScheduleEngine(TimeProvider { sundayUtc })

        val sundayPlan = plan(
            playDays = listOf(7),
            startTime = sundayUtc.minusSeconds(3600),
            endTime = sundayUtc.plusSeconds(3600),
            createdAt = sundayUtc.minusSeconds(7200),
        )
        assertThat(sunEngine.resolveCurrentProgramId(listOf(sundayPlan), device)).isEqualTo(100)

        // playDays 含 0（JS 旧式周日值）不应匹配——domain 用 1..7
        val legacyZeroPlan = plan(
            playDays = listOf(0),
            startTime = sundayUtc.minusSeconds(3600),
            endTime = sundayUtc.plusSeconds(3600),
            createdAt = sundayUtc.minusSeconds(7200),
        )
        assertThat(sunEngine.resolveCurrentProgramId(listOf(legacyZeroPlan), device)).isNull()
    }

    // ===== 门店过滤 =====

    @Test
    fun `targetStoreIds not containing device store is filtered`() {
        assertThat(engine.resolveCurrentProgramId(listOf(plan(targetStoreIds = listOf(99))), device)).isNull()
    }

    @Test
    fun `targetStoreIds containing device store is included`() {
        assertThat(engine.resolveCurrentProgramId(listOf(plan(targetStoreIds = listOf(10, 20))), device)).isEqualTo(100)
    }

    // ===== 多计划取 createdAt desc 首位 =====

    @Test
    fun `multiple matching plans pick latest createdAt`() {
        val older = plan(id = 1, programId = 100, createdAt = fridayUtc.minusSeconds(7200))
        val newer = plan(id = 2, programId = 200, createdAt = fridayUtc.minusSeconds(3600))
        // 传入顺序无关，引擎按 createdAt desc 取首位
        assertThat(engine.resolveCurrentProgramId(listOf(older, newer), device)).isEqualTo(200)
        assertThat(engine.resolveCurrentProgramId(listOf(newer, older), device)).isEqualTo(200)
    }

    @Test
    fun `empty plans returns null`() {
        assertThat(engine.resolveCurrentProgramId(emptyList(), device)).isNull()
    }

    @Test
    fun `no matching plan returns null`() {
        val p = plan(playDays = listOf(1)) // 今日周五不在 [1]
        assertThat(engine.resolveCurrentProgramId(listOf(p), device)).isNull()
    }
}
