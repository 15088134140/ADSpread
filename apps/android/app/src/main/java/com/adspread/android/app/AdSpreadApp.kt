package com.adspread.android.app

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

/**
 * ADSpread 设备端 Application 入口。
 *
 * A0 阶段仅声明 [HiltAndroidApp]；WorkManager / Coil / ExoPlayer 等初始化在后续 Task 接入
 * （spec §11 冷启动 <3s 要求按需 EntryPoint 延迟非关键初始化）。
 *
 * A9 注册 [CrashHandler] 全局异常处理器。
 */
@HiltAndroidApp
class AdSpreadApp : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory

    override fun onCreate() {
        super.onCreate()
        CrashHandler.install(this)
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
}
