import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { StoreModule } from './modules/store/store.module';
import { DeviceModule } from './modules/device/device.module';
import { MaterialModule } from './modules/material/material.module';
import { ProgramModule } from './modules/program/program.module';
import { PublishModule } from './modules/publish/publish.module';
import { DeviceApiModule } from './modules/device-api/device-api.module';
import { SystemModule } from './modules/system/system.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { LoggingMiddleware } from './middleware/logging.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { OperationLogInterceptor } from './common/interceptors/operation-log.interceptor';

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

    // System management (admin/role/menu/log) — 提供 OperationLogService 供全局拦截器复用
    SystemModule,
  ],
  providers: [
    // 全局守卫（APP_GUARD 按注册顺序执行，先注册先执行）：
    // 1) JwtAuthGuard 先认证，填充 request.user；命中 @Public() 直接放行
    // 2) PermissionGuard 后授权，基于 @Public/@AuthenticatedOnly/@RequirePermission 决策
    //    （修复 Task 6 发现的顺序缺陷：控制器级 @UseGuards(JwtAuthGuard) 在全局
    //     PermissionGuard 之后执行导致 request.user 未填充即判 401。现统一全局注册）
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    // 全局拦截器（APP_INTERCEPTOR 按注册顺序执行，先注册为外层）：
    // 1) TransformInterceptor 外层包装统一响应 {code,message,data,timestamp}
    // 2) OperationLogInterceptor 内层记录 @OperationLog 标注的写操作（成功/失败均记录）
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: OperationLogInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
