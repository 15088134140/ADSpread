package com.adspread.android.di

import com.adspread.android.data.local.prefs.DeviceConfigStore
import com.adspread.android.data.remote.BaseUrlProvider
import com.adspread.android.data.remote.MaterialDownloader
import com.adspread.android.data.remote.OkHttpMaterialDownloader
import com.adspread.android.data.remote.TokenProvider
import com.adspread.android.data.remote.api.DeviceApi
import com.adspread.android.data.remote.api.DeviceLifecycleApi
import com.adspread.android.data.remote.api.SyncApi
import com.adspread.android.data.remote.interceptor.DeviceTokenInterceptor
import com.adspread.android.data.remote.interceptor.LanguageInterceptor
import com.adspread.android.data.remote.interceptor.RetryInterceptor
import com.adspread.android.data.remote.interceptor.UnifiedResponseInterceptor
import com.adspread.android.data.remote.socket.DualChannelController
import com.adspread.android.data.remote.socket.ReconnectStrategy
import com.adspread.android.data.remote.socket.SocketEventMapper
import com.adspread.android.data.remote.socket.SocketIoClient
import com.adspread.android.data.remote.socket.SocketIoClientImpl
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import java.net.URI
import java.util.concurrent.TimeUnit
import javax.inject.Qualifier
import javax.inject.Singleton

/**
 * 网络层 Hilt 模块（spec §4.2 / plan A3）。
 *
 * 提供：
 * - [Json]（kotlinx.serialization，对齐 A2 Converters 用库）
 * - OkHttp 拦截器链（[DeviceTokenInterceptor] → [LanguageInterceptor] → [UnifiedResponseInterceptor] → [RetryInterceptor]，spec §4.2 顺序）
 * - [@ApiClient]：Retrofit 专用 OkHttp（含拦截器链 + 日志）
 * - [@DownloadClient]：素材下载专用 OkHttp（**独立**，不走 Unified/Token 拦截器，公开静态资源，spec §4.2）
 * - [Retrofit]（baseUrl 从 [BaseUrlProvider] 取）
 * - API 接口：[DeviceApi] / [SyncApi] / [DeviceLifecycleApi]
 * - [MaterialDownloader]
 * - Socket.io 实例（A4）+ [DualChannelController]
 *
 * **A5 已替换**：[TokenProvider] / [BaseUrlProvider] 由 [com.adspread.android.di.ServiceModule] 绑定
 * 真实实现（DeviceConfigStore / ServerConfigStore）；本模块曾经的临时默认 @Provides 已删除。
 */
@Qualifier
@Retention(AnnotationRetention.BINARY)
private annotation class ApiClient

@Qualifier
@Retention(AnnotationRetention.BINARY)
private annotation class DownloadClient

@Qualifier
@Retention(AnnotationRetention.BINARY)
private annotation class ApplicationScope

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        encodeDefaults = true
    }

    @Provides
    @Singleton
    fun provideLoggingInterceptor(): HttpLoggingInterceptor =
        HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }

    @Provides
    @Singleton
    fun provideDeviceTokenInterceptor(tokenProvider: TokenProvider): DeviceTokenInterceptor =
        DeviceTokenInterceptor(tokenProvider)

    @Provides
    @Singleton
    fun provideLanguageInterceptor(): LanguageInterceptor = LanguageInterceptor()

    @Provides
    @Singleton
    fun provideUnifiedResponseInterceptor(json: Json): UnifiedResponseInterceptor =
        UnifiedResponseInterceptor(json)

    @Provides
    @Singleton
    fun provideRetryInterceptor(): RetryInterceptor = RetryInterceptor()

    @Provides
    @Singleton
    @ApiClient
    fun provideApiOkHttpClient(
        tokenInterceptor: DeviceTokenInterceptor,
        languageInterceptor: LanguageInterceptor,
        unifiedInterceptor: UnifiedResponseInterceptor,
        retryInterceptor: RetryInterceptor,
        loggingInterceptor: HttpLoggingInterceptor,
    ): OkHttpClient = OkHttpClient.Builder()
        // 应用拦截器添加顺序 = 请求方向处理顺序（spec §4.2）：Token → Language → Unified → Retry
        .addInterceptor(tokenInterceptor)
        .addInterceptor(languageInterceptor)
        .addInterceptor(unifiedInterceptor)
        .addInterceptor(retryInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    @Provides
    @Singleton
    @DownloadClient
    fun provideDownloadOkHttpClient(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    @Provides
    @Singleton
    fun provideRetrofit(
        @ApiClient client: OkHttpClient,
        json: Json,
        baseUrlProvider: BaseUrlProvider,
    ): Retrofit = Retrofit.Builder()
        .baseUrl(baseUrlProvider.baseUrl())
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    @Provides
    @Singleton
    fun provideDeviceApi(retrofit: Retrofit): DeviceApi = retrofit.create(DeviceApi::class.java)

    @Provides
    @Singleton
    fun provideSyncApi(retrofit: Retrofit): SyncApi = retrofit.create(SyncApi::class.java)

    @Provides
    @Singleton
    fun provideDeviceLifecycleApi(retrofit: Retrofit): DeviceLifecycleApi =
        retrofit.create(DeviceLifecycleApi::class.java)

    @Provides
    @Singleton
    fun provideMaterialDownloader(@DownloadClient client: OkHttpClient): MaterialDownloader =
        OkHttpMaterialDownloader(client)

    // =========================================================================
    // Socket.io 实时通道（A4：spec §6）
    // =========================================================================

    @Provides
    @Singleton
    @ApplicationScope
    fun provideApplicationScope(): CoroutineScope =
        CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /**
     * socket.io-client-java [Socket] 实例（Singleton）。
     *
     * - URL：从 [BaseUrlProvider] 取后**去掉 `/api` 后缀**（socket path `/socket.io/` 独立于
     *   全局 /api 前缀，main.ts setGlobalPrefix 不影响网关 path，spec §6.1）。
     * - 握手鉴权：`auth = { "token" -> deviceToken }`（后端 `socket.handshake.auth.token` 读取，
     *   spec §6.1）。token 在构造时读一次（A5 接入 DeviceConfigStore）；典型流程下 Socket 首次注入
     *   发生在绑定后的 PlayerService，token 已存在。
     * - **运行时重绑定**：Socket 为 Singleton，auth 在构造时固定；"绑定后已连接的 Socket 重新拿新 token"
     *   属 V1 罕见场景（绑定通常发生在首次 setup，之后 Socket 才首次连接），不支持热重建——如需切换，
     *   走"恢复出厂/重启进程"路径（与 ServerConfigStore 服务器切换一致的 V1 处置）。
     * - 重连：socket.io-client-java 内置重连，参数取自 [ReconnectStrategy]（1s 起、60s 封顶、0.5 抖动）。
     */
    @Provides
    @Singleton
    fun provideSocket(baseUrlProvider: BaseUrlProvider, tokenProvider: TokenProvider): Socket {
        val token = tokenProvider.deviceToken()
        android.util.Log.d("SocketIO", "provideSocket: token=${if (token != null) "present(${token.take(10)}...)" else "null"}")
        val options = IO.Options().apply {
            path = "/socket.io/"
            reconnection = true
            reconnectionDelay = ReconnectStrategy.BASE_DELAY_MILLIS
            reconnectionDelayMax = ReconnectStrategy.MAX_DELAY_MILLIS
            randomizationFactor = ReconnectStrategy.RANDOMIZATION_FACTOR
            auth = token?.let { mutableMapOf("token" to it) } ?: mutableMapOf()
        }
        return IO.socket(socketBaseUrl(baseUrlProvider.baseUrl()), options)
    }

    @Provides
    @Singleton
    fun provideSocketEventMapper(json: Json): SocketEventMapper = SocketEventMapper(json)

    @Provides
    @Singleton
    fun provideSocketIoClientImpl(
        socket: Socket,
        tokenProvider: TokenProvider,
        mapper: SocketEventMapper,
        json: Json,
    ): SocketIoClientImpl = SocketIoClientImpl(socket, tokenProvider, mapper, json)

    @Provides
    @Singleton
    fun provideSocketIoClient(impl: SocketIoClientImpl): SocketIoClient = impl

    @Provides
    @Singleton
    fun provideDualChannelController(
        socketIoClient: SocketIoClient,
        deviceConfigStore: DeviceConfigStore,
        @ApplicationScope scope: CoroutineScope,
    ): DualChannelController =
        DualChannelController(socketIoClient.connectionState, deviceConfigStore.boundFlow, scope)

    /**
     * 从 HTTP baseUrl（`http://host:3000/api/`）派生 Socket.io baseUrl（`http://host:3000`）。
     *
     * Socket.io path `/socket.io/` 独立于 /api 前缀，故需去掉 /api path 段。
     */
    private fun socketBaseUrl(httpBaseUrl: String): URI {
        val uri = URI(httpBaseUrl)
        val portPart = if (uri.port != -1) ":${uri.port}" else ""
        return URI("${uri.scheme}://${uri.host}$portPart")
    }
}
