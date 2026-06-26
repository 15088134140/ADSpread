import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { StoreModule } from './modules/store/store.module';
import { DeviceModule } from './modules/device/device.module';
import { MaterialModule } from './modules/material/material.module';
import { ProgramModule } from './modules/program/program.module';
import { PublishModule } from './modules/publish/publish.module';
import { DeviceApiModule } from './modules/device-api/device-api.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { LoggingMiddleware } from './middleware/logging.middleware';
import { PermissionGuard } from './common/guards/permission.guard';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // Core modules
    PrismaModule,

    // Auth modules
    AuthModule,

    // Business modules
    StoreModule,
    DeviceModule,
    MaterialModule,
    ProgramModule,
    PublishModule,

    // Device-side API (public)
    DeviceApiModule,
  ],
  providers: [
    // 全局权限守卫：在控制器级 @UseGuards(JwtAuthGuard) 之后执行，
    // 负责基于 @Public / @AuthenticatedOnly / @RequirePermission 的授权决策。
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
