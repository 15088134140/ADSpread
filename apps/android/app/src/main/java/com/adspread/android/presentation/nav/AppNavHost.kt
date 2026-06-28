package com.adspread.android.presentation.nav

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.adspread.android.data.local.prefs.DeviceConfigStore
import com.adspread.android.presentation.screen.diagnostic.DiagnosticScreen
import com.adspread.android.presentation.screen.player.PlayerSurface
import com.adspread.android.presentation.screen.setup.SetupScreen

/**
 * 导航路由路径。
 */
object Routes {
    const val SETUP = "setup"
    const val PLAYER = "player"
    const val DIAGNOSTIC = "diagnostic"
}

/**
 * 三目的地导航宿主（spec ADR-A，Task A10）。
 *
 * 导航规则：
 * - 无 deviceToken → SetupScreen（首启绑定）
 * - 有 deviceToken → PlayerScreen（播放画面）
 * - 设置入口（多点触控密码）→ DiagnosticScreen（诊断）
 *
 * 参数传递：
 * - SetupScreen → PlayerScreen：绑定成功后自动导航
 * - PlayerScreen → DiagnosticScreen：通过外部回调触发（由 MainActivity 密码入口驱动）
 * - DiagnosticScreen → SetupScreen：恢复出厂后导航
 *
 * @param deviceConfigStore 用于判断绑定状态以决定 startDestination
 * @param onDiagnosticRequested 外部触发导航到诊断页的信号（由 MainActivity 多点触控密码控制）
 * @param modifier Compose 修饰符
 */
@Composable
fun AppNavHost(
    deviceConfigStore: DeviceConfigStore,
    onDiagnosticRequested: Boolean,
    modifier: Modifier = Modifier,
    navController: NavHostController = rememberNavController(),
) {
    // 首次决定 startDestination（后续不再切换——绑定后重启进程）
    val startDestination = remember {
        if (deviceConfigStore.isBound()) Routes.PLAYER else Routes.SETUP
    }

    // 外部触发导航到诊断页（一次性信号）
    if (onDiagnosticRequested && navController.currentDestination?.route != Routes.DIAGNOSTIC) {
        navController.navigate(Routes.DIAGNOSTIC)
    }

    NavHost(
        navController = navController,
        startDestination = startDestination,
        modifier = modifier,
    ) {
        // 首启配置
        composable(Routes.SETUP) {
            SetupScreen(
                onBound = {
                    navController.navigate(Routes.PLAYER) {
                        popUpTo(Routes.SETUP) { inclusive = true }
                    }
                },
            )
        }

        // 播放画面
        composable(Routes.PLAYER) {
            PlayerSurface(
                onNavigateToDiagnostic = {
                    navController.navigate(Routes.DIAGNOSTIC)
                },
            )
        }

        // 诊断页
        composable(Routes.DIAGNOSTIC) {
            DiagnosticScreen(
                onNavigateToSetup = {
                    navController.navigate(Routes.SETUP) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onRestartApp = {
                    // 服务器切换 / 恢复出厂后重启 App 进程
                    // 由 MainActivity 的 AlarmManager 重启处理
                },
            )
        }
    }
}
