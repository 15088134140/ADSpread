package com.adspread.android.domain.playback

import com.adspread.android.domain.model.MaterialRef
import com.adspread.android.domain.model.MaterialType
import com.adspread.android.domain.model.Region

/** 播放列表策略（spec §5.2 区域素材轮播）。 */
enum class PlaylistMode {
    /** 顺序播放一遍 */
    SEQUENTIAL,
    /** 列表循环（播完回到首项，region 默认） */
    LOOP,
}

/**
 * 播放列表项：关联 [MaterialItem] 配置时长与 [MaterialRef] 素材元数据。
 *
 * @param materialId 素材 ID
 * @param durationSec 配置展示时长（秒，来自 `layoutConfig.regions[].materials[].duration`）
 * @param material 素材元数据（含 type/duration，决定时长换算策略）
 */
data class PlaylistItem(
    val materialId: Int,
    val durationSec: Int,
    val material: MaterialRef,
) {
    /**
     * 该项展示时长（毫秒）。
     *
     * - 视频：按 [MaterialRef.duration] 自身时长（秒→毫秒）；若视频 `duration` 为 null 回退 [durationSec]
     * - 图片/跑马灯：按 [durationSec]（秒→毫秒）
     *
     * 对齐 spec §4.3：`duration` 单位为秒，客户端换算毫秒时 `× 1000`。
     */
    fun durationMs(): Long {
        val secs = if (material.type == MaterialType.VIDEO) {
            material.duration ?: durationSec
        } else {
            durationSec
        }
        return secs.toLong() * MILLIS_PER_SECOND
    }

    private companion object {
        private const val MILLIS_PER_SECOND = 1000L
    }
}

/**
 * 区域播放列表（纯逻辑，便于单测）。
 *
 * 由 [PlaybackOrchestrator] 根据 [Region] + 素材元数据构建；service 层（A6）消费
 * [durationsMs] 驱动 ExoPlayer/图片轮播切换时序。
 */
class Playlist(
    val items: List<PlaylistItem>,
    val mode: PlaylistMode = PlaylistMode.LOOP,
) {
    /** 各项展示时长序列（毫秒），与 [items] 顺序对应。 */
    fun durationsMs(): List<Long> = items.map { it.durationMs() }

    /** 列表总时长（毫秒），空列表为 0。 */
    fun totalDurationMs(): Long = durationsMs().sum()
}

/**
 * 播放编排器端口（spec §7.1，A6 `PlayerService` 实现）。
 *
 * domain 定义此接口供 `PlayerController` 依赖倒置；实现消费
 * [com.adspread.android.domain.schedule.LocalScheduleEngine] 输出的节目，
 * 构建各 region 的 [Playlist] 并驱动播放/切换。
 */
interface PlaybackOrchestrator {
    /**
     * 为指定 region 构建播放列表。
     *
     * @param region 节目区域
     * @param materials 素材元数据集合（key=materialId），用于关联 [PlaylistItem.material]
     * @return 该 region 的播放列表；region 无素材或素材元数据缺失时 items 为空
     */
    fun buildPlaylist(region: Region, materials: Map<Int, MaterialRef>): Playlist
}
