package com.adspread.android.di

import android.content.Context
import com.adspread.android.data.local.cache.MaterialStore
import com.adspread.android.data.local.db.dao.DownloadQueueDao
import com.adspread.android.data.local.db.dao.EventLogDao
import com.adspread.android.data.local.db.dao.MaterialMetaDao
import com.adspread.android.data.local.db.dao.PlayLogDao
import com.adspread.android.data.local.db.dao.ProgramCacheDao
import com.adspread.android.data.local.db.dao.PublishPlanCacheDao
import com.adspread.android.data.local.prefs.DeviceConfigStore
import com.adspread.android.data.local.prefs.EncryptedSecurePrefs
import com.adspread.android.data.local.prefs.SecurePrefs
import com.adspread.android.data.local.prefs.ServerConfigStore
import com.adspread.android.data.remote.BaseUrlProvider
import com.adspread.android.data.remote.TokenProvider
import com.adspread.android.data.remote.api.DeviceLifecycleApi
import com.adspread.android.data.remote.api.SyncApi
import com.adspread.android.data.remote.socket.SocketIoClient
import com.adspread.android.data.repository.DeviceRepository
import com.adspread.android.data.repository.LogRepository
import com.adspread.android.data.repository.ProgramRepository
import com.adspread.android.data.repository.SyncRepository
import com.adspread.android.domain.command.Command
import com.adspread.android.domain.command.CommandRouter
import com.adspread.android.domain.schedule.TimeProvider
import com.adspread.android.domain.sync.SyncResolver
import com.adspread.android.service.orchestration.CommandRouterImpl
import com.adspread.android.service.orchestration.ScreenshotCapture
import com.adspread.android.service.orchestration.handler.BrightnessHandler
import com.adspread.android.service.orchestration.handler.ClearCacheHandler
import com.adspread.android.service.orchestration.handler.CommandHandler
import com.adspread.android.service.orchestration.handler.FetchLogsHandler
import com.adspread.android.service.orchestration.handler.ReloadHandler
import com.adspread.android.service.orchestration.handler.ResumeHandler
import com.adspread.android.service.orchestration.handler.RestartAppHandler
import com.adspread.android.service.orchestration.handler.ScreenshotHandler
import com.adspread.android.service.orchestration.handler.StopHandler
import com.adspread.android.service.orchestration.handler.SwitchProgramHandler
import com.adspread.android.service.orchestration.handler.UpdateConfigHandler
import com.adspread.android.service.orchestration.handler.VolumeHandler
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import java.io.File
import java.time.Instant
import javax.inject.Singleton

/**
 * Service 层 Hilt 模块（spec §9 / §2，plan A5 step 5）。
 *
 * 提供：
 * - 加密存储链：[SecurePrefs]（[EncryptedSecurePrefs]）→ [DeviceConfigStore] → [TokenProvider]
 * - 服务器配置：[ServerConfigStore] → [BaseUrlProvider]
 * - [MaterialStore]（app 专属目录 LRU，K5）
 * - [SyncResolver] / [TimeProvider]（domain 端口实现）
 * - 4 个 Repository
 *
 * **替换 A3 临时绑定**：[TokenProvider] / [BaseUrlProvider] 原由 NetworkModule 临时默认提供
 * （返回 null token / 模拟器 baseUrl），现由本模块绑定真实实现（DeviceConfigStore / ServerConfigStore），
 * NetworkModule 临时 @Provides 已删除（Hilt 不允许重复 binding）。
 */
@Module
@InstallIn(SingletonComponent::class)
object ServiceModule {

    // ===== 加密设备配置 =====

    @Provides
    @Singleton
    fun provideSecurePrefs(@ApplicationContext context: Context): SecurePrefs =
        EncryptedSecurePrefs(context)

    @Provides
    @Singleton
    fun provideDeviceConfigStore(prefs: SecurePrefs, json: Json): DeviceConfigStore =
        DeviceConfigStore(prefs, json)

    @Provides
    @Singleton
    fun provideTokenProvider(store: DeviceConfigStore): TokenProvider = store

    // ===== 服务器配置 =====

    @Provides
    @Singleton
    fun provideServerConfigStore(@ApplicationContext context: Context): ServerConfigStore =
        ServerConfigStore(context)

    @Provides
    @Singleton
    fun provideBaseUrlProvider(store: ServerConfigStore): BaseUrlProvider = store

    // ===== 素材缓存 =====

    @Provides
    @Singleton
    fun provideMaterialStore(@ApplicationContext context: Context): MaterialStore =
        MaterialStore(File(context.filesDir, "materials"))

    // ===== domain 端口实现 =====

    @Provides
    @Singleton
    fun provideSyncResolver(): SyncResolver = SyncResolver()

    @Provides
    @Singleton
    fun provideTimeProvider(): TimeProvider = TimeProvider { Instant.now() }

    // ===== Repository =====

    @Provides
    @Singleton
    fun provideProgramRepository(
        programDao: ProgramCacheDao,
        materialDao: MaterialMetaDao,
        planDao: PublishPlanCacheDao,
    ): ProgramRepository = ProgramRepository(programDao, materialDao, planDao)

    @Provides
    @Singleton
    fun provideSyncRepository(
        syncApi: SyncApi,
        planDao: PublishPlanCacheDao,
        programDao: ProgramCacheDao,
        materialDao: MaterialMetaDao,
        downloadQueueDao: DownloadQueueDao,
        configStore: DeviceConfigStore,
        materialStore: MaterialStore,
        syncResolver: SyncResolver,
        timeProvider: TimeProvider,
        @ApplicationContext appContext: Context,
    ): SyncRepository = SyncRepository(
        syncApi, planDao, programDao, materialDao, downloadQueueDao,
        configStore, materialStore, syncResolver, timeProvider, appContext,
    )

    @Provides
    @Singleton
    fun provideDeviceRepository(
        lifecycleApi: DeviceLifecycleApi,
        configStore: DeviceConfigStore,
        eventLogDao: EventLogDao,
        timeProvider: TimeProvider,
        json: Json,
    ): DeviceRepository = DeviceRepository(lifecycleApi, configStore, eventLogDao, timeProvider, json)

    @Provides
    @Singleton
    fun provideLogRepository(
        lifecycleApi: DeviceLifecycleApi,
        playLogDao: PlayLogDao,
        eventLogDao: EventLogDao,
        configStore: DeviceConfigStore,
        json: Json,
    ): LogRepository = LogRepository(lifecycleApi, playLogDao, eventLogDao, configStore, json)

    // ===== CommandRouter + Handlers（Task A8） =====

    @Provides
    @Singleton
    fun provideCommandRouter(
        socketIoClient: SocketIoClient,
        screenshotCapture: ScreenshotCapture,
        handlerMap: Map<Command, @JvmSuppressWildcards CommandHandler>,
        syncRepository: com.adspread.android.data.repository.SyncRepository,
    ): CommandRouterImpl = CommandRouterImpl(socketIoClient, screenshotCapture, handlerMap, syncRepository)

    @Provides
    @Singleton
    fun provideCommandRouterPort(impl: CommandRouterImpl): CommandRouter = impl

    // ---- handler map（手动构建，避免 @IntoMap + @MapKey 的 KSP 兼容性） ----

    @Provides
    @Singleton
    fun provideHandlerMap(
        screenshotHandler: ScreenshotHandler,
        volumeHandler: VolumeHandler,
        brightnessHandler: BrightnessHandler,
        stopHandler: StopHandler,
        resumeHandler: ResumeHandler,
        reloadHandler: ReloadHandler,
        clearCacheHandler: ClearCacheHandler,
        fetchLogsHandler: FetchLogsHandler,
        restartAppHandler: RestartAppHandler,
        updateConfigHandler: UpdateConfigHandler,
        switchProgramHandler: SwitchProgramHandler,
    ): Map<Command, @JvmSuppressWildcards CommandHandler> = mapOf(
        Command.SCREENSHOT to screenshotHandler,
        Command.VOLUME to volumeHandler,
        Command.BRIGHTNESS to brightnessHandler,
        Command.STOP to stopHandler,
        Command.RESUME to resumeHandler,
        Command.RELOAD to reloadHandler,
        Command.CLEAR_CACHE to clearCacheHandler,
        Command.FETCH_LOGS to fetchLogsHandler,
        Command.RESTART_APP to restartAppHandler,
        Command.UPDATE_CONFIG to updateConfigHandler,
        Command.SWITCH_PROGRAM to switchProgramHandler,
    )
}

// ServiceModule end
