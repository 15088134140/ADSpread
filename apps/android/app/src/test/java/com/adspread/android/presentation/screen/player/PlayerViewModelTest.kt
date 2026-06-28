package com.adspread.android.presentation.screen.player

import com.adspread.android.data.repository.ProgramRepository
import com.adspread.android.domain.model.MaterialType
import com.adspread.android.domain.model.Program
import com.adspread.android.domain.model.Region
import com.adspread.android.domain.model.ScreenOrientation
import com.adspread.android.domain.model.SplitType
import com.adspread.android.domain.playback.RegionPlaybackState
import com.adspread.android.service.orchestration.PlayerController
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

/**
 * [PlayerViewModel] 单测（Task A10）。
 *
 * 验证：
 * - [PlayerUiState] 正确从 [PlayerController.state] 和 [ProgramRepository] 构建
 * - bounds 本地计算（ADR-D / K9）
 * - SPLIT_1 / SPLIT_2 / SPLIT_4 三档分屏映射
 * - 无活跃节目时 isEmpty=true
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PlayerViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var playerController: PlayerController
    private lateinit var programRepository: ProgramRepository
    private lateinit var viewModel: PlayerViewModel

    @BeforeEach
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        playerController = mockk()
        programRepository = mockk()
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `isEmpty when no playback states`() = runTest(testDispatcher) {
        every { playerController.state } returns MutableStateFlow(emptyMap())
        viewModel = PlayerViewModel(playerController, programRepository)

        testDispatcher.scheduler.advanceUntilIdle()

        assertThat(viewModel.uiState.value.isEmpty).isTrue()
        assertThat(viewModel.uiState.value.regions).isEmpty()
    }

    @Test
    fun `SPLIT_1 produces one region with fullscreen bounds`() = runTest(testDispatcher) {
        val program = Program(
            id = 1,
            name = "全屏节目",
            screenOrientation = ScreenOrientation.LANDSCAPE,
            splitType = SplitType.SPLIT_1,
            regions = listOf(Region(regionId = "region1", materials = emptyList())),
            status = 1,
        )
        val playbackStates = mapOf(
            "region1" to RegionPlaybackState(
                regionId = "region1",
                programId = 1,
                currentIndex = 0,
                currentMaterialId = 1,
                currentMaterialLocalPath = "/tmp/test.jpg",
                materialType = MaterialType.IMAGE,
                playlistSize = 1,
                decodeTier = null,
                remoteFileUrl = null, startedAtMs = 1000L,
            )
        )

        every { playerController.state } returns MutableStateFlow(playbackStates)
        coEvery { programRepository.getProgram(1) } returns program
        viewModel = PlayerViewModel(playerController, programRepository)

        testDispatcher.scheduler.advanceUntilIdle()

        val uiState = viewModel.uiState.value
        assertThat(uiState.isEmpty).isFalse()
        assertThat(uiState.regions).hasSize(1)

        val region = uiState.regions[0]
        assertThat(region.regionId).isEqualTo("region1")
        assertThat(region.bounds.regionId).isEqualTo("region1")
        assertThat(region.bounds.x).isEqualTo(0.0)
        assertThat(region.bounds.y).isEqualTo(0.0)
        assertThat(region.bounds.width).isEqualTo(1.0)
        assertThat(region.bounds.height).isEqualTo(1.0)
    }

    @Test
    fun `SPLIT_2 LANDSCAPE produces two side-by-side regions`() = runTest(testDispatcher) {
        val program = Program(
            id = 2,
            name = "左右分屏",
            screenOrientation = ScreenOrientation.LANDSCAPE,
            splitType = SplitType.SPLIT_2,
            regions = listOf(
                Region(regionId = "region1", materials = emptyList()),
                Region(regionId = "region2", materials = emptyList()),
            ),
            status = 1,
        )
        val playbackStates = mapOf(
            "region1" to RegionPlaybackState(
                regionId = "region1", programId = 2, currentIndex = 0,
                currentMaterialId = 1, currentMaterialLocalPath = "/tmp/a.jpg",
                materialType = MaterialType.IMAGE, playlistSize = 1, decodeTier = null, remoteFileUrl = null, startedAtMs = 1000L,
            ),
            "region2" to RegionPlaybackState(
                regionId = "region2", programId = 2, currentIndex = 0,
                currentMaterialId = 2, currentMaterialLocalPath = "/tmp/b.jpg",
                materialType = MaterialType.IMAGE, playlistSize = 1, decodeTier = null, remoteFileUrl = null, startedAtMs = 1000L,
            ),
        )

        every { playerController.state } returns MutableStateFlow(playbackStates)
        coEvery { programRepository.getProgram(2) } returns program
        viewModel = PlayerViewModel(playerController, programRepository)

        testDispatcher.scheduler.advanceUntilIdle()

        val uiState = viewModel.uiState.value
        assertThat(uiState.isEmpty).isFalse()
        assertThat(uiState.regions).hasSize(2)

        // 左半
        assertThat(uiState.regions[0].bounds.x).isEqualTo(0.0)
        assertThat(uiState.regions[0].bounds.y).isEqualTo(0.0)
        assertThat(uiState.regions[0].bounds.width).isEqualTo(0.5)
        assertThat(uiState.regions[0].bounds.height).isEqualTo(1.0)

        // 右半
        assertThat(uiState.regions[1].bounds.x).isEqualTo(0.5)
        assertThat(uiState.regions[1].bounds.y).isEqualTo(0.0)
        assertThat(uiState.regions[1].bounds.width).isEqualTo(0.5)
        assertThat(uiState.regions[1].bounds.height).isEqualTo(1.0)
    }

    @Test
    fun `SPLIT_4 produces four quadrants`() = runTest(testDispatcher) {
        val program = Program(
            id = 3,
            name = "四宫格",
            screenOrientation = ScreenOrientation.LANDSCAPE,
            splitType = SplitType.SPLIT_4,
            regions = listOf(
                Region(regionId = "region1", materials = emptyList()),
                Region(regionId = "region2", materials = emptyList()),
                Region(regionId = "region3", materials = emptyList()),
                Region(regionId = "region4", materials = emptyList()),
            ),
            status = 1,
        )
        val playbackStates = (1..4).associate { i ->
            "region$i" to RegionPlaybackState(
                regionId = "region$i", programId = 3, currentIndex = 0,
                currentMaterialId = i, currentMaterialLocalPath = "/tmp/$i.jpg",
                materialType = MaterialType.IMAGE, playlistSize = 1, decodeTier = null, remoteFileUrl = null, startedAtMs = 1000L,
            )
        }

        every { playerController.state } returns MutableStateFlow(playbackStates)
        coEvery { programRepository.getProgram(3) } returns program
        viewModel = PlayerViewModel(playerController, programRepository)

        testDispatcher.scheduler.advanceUntilIdle()

        val uiState = viewModel.uiState.value
        assertThat(uiState.isEmpty).isFalse()
        assertThat(uiState.regions).hasSize(4)

        // 四象限验证
        val expectedBounds = listOf(
            listOf(0.0, 0.0, 0.5, 0.5),   // region1: 左上
            listOf(0.5, 0.0, 0.5, 0.5),   // region2: 右上
            listOf(0.0, 0.5, 0.5, 0.5),   // region3: 左下
            listOf(0.5, 0.5, 0.5, 0.5),   // region4: 右下
        )
        uiState.regions.forEachIndexed { index, region ->
            val expected = expectedBounds[index]
            assertThat(region.bounds.x).isEqualTo(expected[0])
            assertThat(region.bounds.y).isEqualTo(expected[1])
            assertThat(region.bounds.width).isEqualTo(expected[2])
            assertThat(region.bounds.height).isEqualTo(expected[3])
        }
    }

    @Test
    fun `SPLIT_2 PORTRAIT produces top-bottom regions`() = runTest(testDispatcher) {
        val program = Program(
            id = 4,
            name = "上下分屏",
            screenOrientation = ScreenOrientation.PORTRAIT,
            splitType = SplitType.SPLIT_2,
            regions = listOf(
                Region(regionId = "region1", materials = emptyList()),
                Region(regionId = "region2", materials = emptyList()),
            ),
            status = 1,
        )
        val playbackStates = mapOf(
            "region1" to RegionPlaybackState(
                regionId = "region1", programId = 4, currentIndex = 0,
                currentMaterialId = 1, currentMaterialLocalPath = "/tmp/top.jpg",
                materialType = MaterialType.IMAGE, playlistSize = 1, decodeTier = null, remoteFileUrl = null, startedAtMs = 1000L,
            ),
            "region2" to RegionPlaybackState(
                regionId = "region2", programId = 4, currentIndex = 0,
                currentMaterialId = 2, currentMaterialLocalPath = "/tmp/bottom.jpg",
                materialType = MaterialType.IMAGE, playlistSize = 1, decodeTier = null, remoteFileUrl = null, startedAtMs = 1000L,
            ),
        )

        every { playerController.state } returns MutableStateFlow(playbackStates)
        coEvery { programRepository.getProgram(4) } returns program
        viewModel = PlayerViewModel(playerController, programRepository)

        testDispatcher.scheduler.advanceUntilIdle()

        val uiState = viewModel.uiState.value
        assertThat(uiState.regions).hasSize(2)

        // 上半
        assertThat(uiState.regions[0].bounds.x).isEqualTo(0.0)
        assertThat(uiState.regions[0].bounds.y).isEqualTo(0.0)
        assertThat(uiState.regions[0].bounds.width).isEqualTo(1.0)
        assertThat(uiState.regions[0].bounds.height).isEqualTo(0.5)

        // 下半
        assertThat(uiState.regions[1].bounds.x).isEqualTo(0.0)
        assertThat(uiState.regions[1].bounds.y).isEqualTo(0.5)
        assertThat(uiState.regions[1].bounds.width).isEqualTo(1.0)
        assertThat(uiState.regions[1].bounds.height).isEqualTo(0.5)
    }

    @Test
    fun `playerForRegion delegates to controller`() {
        every { playerController.state } returns MutableStateFlow(emptyMap())
        every { playerController.playerForRegion("region1") } returns null
        viewModel = PlayerViewModel(playerController, programRepository)

        val player = viewModel.playerForRegion("region1")
        assertThat(player).isNull()
    }
}
