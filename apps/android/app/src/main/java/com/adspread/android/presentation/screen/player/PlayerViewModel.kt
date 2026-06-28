package com.adspread.android.presentation.screen.player

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.exoplayer.ExoPlayer
import com.adspread.android.data.repository.ProgramRepository
import com.adspread.android.domain.layout.RegionBoundsMapper
import com.adspread.android.domain.model.RegionBounds
import com.adspread.android.domain.playback.RegionPlaybackState
import com.adspread.android.service.orchestration.PlayerController
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

/**
 * 播放区域组合 UI 状态（Task A10）。
 *
 * @param regionId 区域标识
 * @param playbackState 该区域当前播放状态；null 表示无活跃播放
 * @param bounds 该区域在屏幕上的比例边界（由 [RegionBoundsMapper] 计算）
 */
data class RegionUiState(
    val regionId: String,
    val playbackState: RegionPlaybackState?,
    val bounds: RegionBounds,
)

/**
 * 播放画面 UI 状态（spec ADR-C，Task A10）。
 *
 * @param regions 有序区域状态列表，按 bounds 顺序排列（与 [RegionBoundsMapper] 输出一致）
 * @param isEmpty 无活跃节目/区域时为 true，显示占位
 */
data class PlayerUiState(
    val regions: List<RegionUiState> = emptyList(),
    val isEmpty: Boolean = true,
)

/**
 * 播放画面 ViewModel（spec ADR-C，Task A10）。
 *
 * 职责：
 * 1. 订阅 [PlayerController.state]（播放状态 Flow），转换为 [PlayerUiState]
 * 2. 调用 [RegionBoundsMapper] 本地计算 bounds（ADR-D / K9，不读后端 bounds）
 * 3. 暴露 [playerForRegion] 供 [VideoSurface][com.adspread.android.presentation.component.VideoSurface] 绑定 ExoPlayer Surface
 *
 * bounds 在 program 切换时重新计算，由 map 驱动重组。
 */
@HiltViewModel
class PlayerViewModel @Inject constructor(
    private val playerController: PlayerController,
    private val programRepository: ProgramRepository,
) : ViewModel() {

    /** PlayerController 原始播放状态（regionId → RegionPlaybackState）。 */
    val playbackStates: StateFlow<Map<String, RegionPlaybackState>> = playerController.state

    /**
     * 合并后的播放 UI 状态，含 bounds 映射。
     *
     * 每次播放状态变化时重新计算 bounds（program 切换时 screenOrientation/splitType 可能变化）。
     * bounds 由 [RegionBoundsMapper] 本地计算（ADR-D），不依赖后端 bounds 字段。
     */
    @OptIn(ExperimentalCoroutinesApi::class)
    val uiState: StateFlow<PlayerUiState> = playbackStates.flatMapLatest { states ->
        if (states.isEmpty()) {
            flowOf(PlayerUiState(isEmpty = true))
        } else {
            // 取出第一个 state 中的 programId 作查找
            val programId = states.values.firstOrNull()?.programId
            if (programId == null) {
                flowOf(PlayerUiState(isEmpty = true))
            } else {
                // 转为 Flow，emit 一次查询结果
                flow { emit(loadProgram(programId, states)) }
            }
        }
    }.stateIn(viewModelScope, SharingStarted.Eagerly, PlayerUiState(isEmpty = true))

    /**
     * 加载节目并构建 UI 状态（挂起函数，由 map 调用）。
     */
    private suspend fun loadProgram(
        programId: Int,
        states: Map<String, RegionPlaybackState>,
    ): PlayerUiState {
        val program = programRepository.getProgram(programId) ?: return PlayerUiState(isEmpty = true).also {
            Log.d(TAG, "loadProgram: program $programId not found")
        }
        val boundsList = RegionBoundsMapper.getRegionBounds(
            screenOrientation = program.screenOrientation,
            splitType = program.splitType,
        )
        val regions = boundsList.map { bounds ->
            val state = states[bounds.regionId]
            RegionUiState(
                regionId = bounds.regionId,
                playbackState = state,
                bounds = bounds,
            )
        }
        Log.d(TAG, "loadProgram: program=$programId, orientation=${program.screenOrientation}, split=${program.splitType}, bounds=${boundsList.size}, states=${states.size}, regions=${regions.size}")
        return PlayerUiState(regions = regions, isEmpty = regions.isEmpty())
    }

    /** 供 [VideoSurface] 绑定 Surface 的视频 region ExoPlayer；图片 region 返回 null。 */
    fun playerForRegion(regionId: String): ExoPlayer? = playerController.playerForRegion(regionId)

    private companion object {
        const val TAG = "PlayerVM"
    }
}
