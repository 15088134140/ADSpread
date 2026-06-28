package com.adspread.android.di

import android.content.Context
import androidx.room.Room
import com.adspread.android.data.local.db.AppDatabase
import com.adspread.android.data.local.db.dao.DeviceConfigDao
import com.adspread.android.data.local.db.dao.DownloadQueueDao
import com.adspread.android.data.local.db.dao.EventLogDao
import com.adspread.android.data.local.db.dao.MaterialMetaDao
import com.adspread.android.data.local.db.dao.PlayLogDao
import com.adspread.android.data.local.db.dao.ProgramCacheDao
import com.adspread.android.data.local.db.dao.PublishPlanCacheDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Room 数据库 Hilt 模块（spec §4.1，plan A5 step 5）。
 *
 * 提供 [AppDatabase]（Singleton）+ 7 个 DAO。V1 schema version=1，无迁移；后续新增/改表须按
 * [AppDatabase] KDoc 契约编写 `Migration` 并在此 `addMigrations` 注册（不启用 destructive fallback，
 * 强制显式迁移）。
 */
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, AppDatabase.DB_NAME)
            .build()

    @Provides
    fun provideDeviceConfigDao(db: AppDatabase): DeviceConfigDao = db.deviceConfigDao()

    @Provides
    fun providePublishPlanCacheDao(db: AppDatabase): PublishPlanCacheDao = db.publishPlanCacheDao()

    @Provides
    fun provideProgramCacheDao(db: AppDatabase): ProgramCacheDao = db.programCacheDao()

    @Provides
    fun provideMaterialMetaDao(db: AppDatabase): MaterialMetaDao = db.materialMetaDao()

    @Provides
    fun provideDownloadQueueDao(db: AppDatabase): DownloadQueueDao = db.downloadQueueDao()

    @Provides
    fun providePlayLogDao(db: AppDatabase): PlayLogDao = db.playLogDao()

    @Provides
    fun provideEventLogDao(db: AppDatabase): EventLogDao = db.eventLogDao()
}
