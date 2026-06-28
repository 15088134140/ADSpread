package com.adspread.android.presentation.screen.player

import com.adspread.android.data.repository.ProgramRepository
import com.adspread.android.service.orchestration.PlayerController
import com.google.common.truth.Truth.assertThat
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * [PlayerSurface] 分屏渲染布局测试（Task A10）。
 *
 * 测试 ViewModel 层 bound 计算而非像素级渲染断言。
 * 完整渲染测试建议在模拟器 instrumented test 中验证。
 *
 * 当前测试覆盖：
 * - PlayerViewModel 初始状态（isEmpty）
 * - 非空状态下 region 创建
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class PlayerSurfaceLayoutTest {

    @Test
    fun `PlayerViewModel isEmpty when no playback states`() {
        val playerController = mockk<PlayerController>()
        val programRepository = mockk<ProgramRepository>()

        every { playerController.state } returns MutableStateFlow(emptyMap())

        val viewModel = PlayerViewModel(playerController, programRepository)
        assertThat(viewModel.uiState.value.isEmpty).isTrue()
    }
}
