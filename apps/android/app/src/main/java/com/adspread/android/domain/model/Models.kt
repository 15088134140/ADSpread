package com.adspread.android.domain.model

import java.time.Instant

/**
 * 区域边界（比例值 0~1）。客户端用 `bounds.x * 屏幕宽` 得像素偏移。
 *
 * 忠实移植 `apps/backend/src/common/utils/layout.ts` 的 `RegionBounds`。
 * domain 层本地计算（ADR-D），**不依赖**后端下发 region 内 `bounds` 字段。
 *
 * @param regionId 区域标识（region1/region2/...，按 region 索引顺序分配，守卫 ADR-D）
 */
data class RegionBounds(
    val regionId: String,
    val x: Double,
    val y: Double,
    val width: Double,
    val height: Double,
)

/**
 * 素材元数据引用（对齐 `packages/api-contracts/device/types.ts` 的 `MaterialDto`）。
 *
 * domain 不依赖 data 层 DTO；字段与之对齐，由 mapper 层负责 DTO↔domain 转换。
 * `fileSize` 后端 BigInt 序列化为字符串下发，domain 用 [Long] 承载（mapper 负责 string→Long）。
 * `duration`：视频时长（秒），图片为 null。
 *
 * 注意：sync DTO **不下发** per-material `updatedAt`/`version`（仅全局 version 作 ETag），
 * 故 [com.adspread.android.domain.sync.SyncResolver] 按整体字段相等性（data class equals）
 * 判定更新，而非版本号比较——这是与 DTO 契约对齐的必要偏离。
 */
data class MaterialRef(
    val id: Int,
    val name: String,
    val type: MaterialType,
    val fileUrl: String,
    val fileSize: Long,
    val fileExtension: String,
    val width: Int?,
    val height: Int?,
    /** 视频时长（秒），图片为 null */
    val duration: Int?,
    val thumbnailUrl: String?,
)

/**
 * 区域内单个素材项（对齐 spec §4.3 `NormalizedMaterialItem`）。
 *
 * @param materialId 素材 ID，关联 [MaterialRef.id]
 * @param durationSec 配置展示时长（秒）。图片/跑马灯按此值展示；视频按 [MaterialRef.duration] 自身时长播放
 */
data class MaterialItem(
    val materialId: Int,
    val durationSec: Int,
)

/**
 * 节目区域（对齐 spec §4.3 `NormalizedRegion`）。
 *
 * **不含 bounds**——客户端按 `(screenOrientation, splitType)` + region 索引
 * 调 [com.adspread.android.domain.layout.RegionBoundsMapper] 本地计算（ADR-D，规避后端 B1 bug）。
 */
data class Region(
    val regionId: String,
    val materials: List<MaterialItem>,
)

/**
 * 节目（对齐 `packages/api-contracts/device/types.ts` 的 `ProgramDto`）。
 *
 * `layoutConfig` 在 domain 层展开为 [regions]，bounds 由本地计算。
 *
 * @param status 1=已发布, 0=草稿（sync 仅下发 status=1）
 */
data class Program(
    val id: Int,
    val name: String,
    val screenOrientation: ScreenOrientation,
    val splitType: SplitType,
    val regions: List<Region>,
    val status: Int,
)

/**
 * 发布计划（对齐 `packages/api-contracts/device/types.ts` 的 `PublishPlanDto`）。
 *
 * 日期字段用 [Instant]（domain 内部时区无关），mapper 负责 ISO 8601 string → Instant。
 * [com.adspread.android.domain.schedule.LocalScheduleEngine] 用 Asia/Shanghai 时区判定星期。
 *
 * @param status 1=启用, 0=停用
 * @param playDays 播放星期列表（1=周一…7=周日，对齐 `java.time.DayOfWeek.value` 与后端 `getDay()||7`）
 */
data class PublishPlan(
    val id: Int,
    val programId: Int,
    val targetStoreIds: List<Int>,
    val startTime: Instant,
    val endTime: Instant?,
    val playDays: List<Int>,
    val status: Int,
    val createdAt: Instant,
)

/**
 * 设备身份（对齐 `packages/api-contracts/device/types.ts` 的 `DeviceIdentity`）。
 *
 * @param storeId 所属门店 ID；null 表示未绑定门店，不进入本地调度（spec §5.2 未绑定设备边界）
 */
data class DeviceIdentity(
    val id: Int,
    val code: String,
    val storeId: Int?,
)
