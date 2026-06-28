package com.adspread.android.domain.schedule

import com.adspread.android.domain.model.DeviceIdentity
import com.adspread.android.domain.model.PublishPlan
import java.time.Instant
import java.time.ZoneId

/**
 * 当前时间提供者（依赖倒置端口）。
 *
 * domain 定义此接口便于单测注入固定时间；生产实现由 infra 层提供
 * （如基于 `System.currentTimeMillis()` / `Clock.systemDefaultZone()`）。
 */
fun interface TimeProvider {
    /** 当前时刻（时区无关，星期判定由调用方套时区）。 */
    fun now(): Instant
}

/**
 * 本地播放调度器（spec §5.2，仅日级对齐 D4）。
 *
 * 忠实移植 `apps/backend/src/modules/device-api/device-api.service.ts` 的 `getCurrentProgram`
 * 过滤逻辑，在端侧本地复算当前应播节目（替代每次请求后端）：
 *
 * 1. `storeId=null`（未绑定门店）→ 不进入调度，返回 null（对齐 `device-api.service.ts` 未绑定设备边界）
 * 2. 过滤 `status=1 && startTime<=now && (endTime==null || endTime>=now)`
 * 3. 过滤 `playDays` 含今日（1=周一…7=周日，周日映射 7，对齐后端 `getDay()||7` 与 `java.time.DayOfWeek.value`）
 * 4. 过滤 `targetStoreIds` 含本设备 `storeId`
 * 5. 按 `createdAt desc` 取首位 → `programId`
 *
 * 时区 Asia/Shanghai（与后端服务器时区一致，影响星期判定）。
 * 仅日级调度（D4），无日内时段切换。
 *
 * **program.status 检查不在本引擎职责**——sync 接口仅下发 `status=1` 的 program
 * （`device-api.service.ts` sync 实现），故缓存中的 program 已为已发布状态。
 */
class LocalScheduleEngine(private val timeProvider: TimeProvider) {

    /**
     * 解析当前应播节目的 programId。
     *
     * @param plans 本地缓存的全量发布计划（status=0/1 均可能在缓存中，引擎内部按 status=1 过滤）
     * @param device 本设备身份
     * @return 匹配计划的 programId；无匹配或未绑定门店返回 null
     */
    fun resolveCurrentProgramId(plans: List<PublishPlan>, device: DeviceIdentity): Int? {
        val storeId = device.storeId ?: return null  // 未绑定门店不进调度

        val now = timeProvider.now()
        val today = now.atZone(ZONE_SHANGHAI).dayOfWeek.value  // 1=Mon..7=Sun

        return plans
            .asSequence()
            .filter { it.status == 1 }
            .filter { !it.startTime.isAfter(now) }                       // startTime <= now
            .filter { it.endTime == null || !it.endTime.isBefore(now) }  // endTime null || endTime >= now
            .filter { today in it.playDays }
            .filter { storeId in it.targetStoreIds }
            .maxByOrNull { it.createdAt }
            ?.programId
    }

    private companion object {
        private val ZONE_SHANGHAI = ZoneId.of("Asia/Shanghai")
    }
}
