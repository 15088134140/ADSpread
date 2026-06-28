package com.adspread.android.di

import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

/**
 * UI 层 Hilt 模块（Task A10）。
 *
 * 当前所有 ViewModel 均使用 [dagger.hilt.android.lifecycle.HiltViewModel] + `@Inject constructor`，
 * 依赖由 Hilt 自动注入（PlayerController / DeviceRepository / DeviceConfigStore / ServerConfigStore /
 * ProgramRepository / SyncRepository / MaterialStore / LogRepository 等已在 ServiceModule / PlayerModule
 * 中绑定为 Singleton）。
 *
 * 本模块保留占位，后续若需提供 UI 层特定依赖（如格式化工具、导航回调）在此声明。
 * 避免引入未被要求的抽象（CLAUDE.md 硬规则 4）。
 */
@Module
@InstallIn(SingletonComponent::class)
object UiModule
