import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { HttpAdapterHost } from '@nestjs/core';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );
  // 全局守卫（JwtAuthGuard + PermissionGuard）与拦截器（TransformInterceptor +
  // OperationLogInterceptor）由 AppModule 的 APP_GUARD / APP_INTERCEPTOR provider
  // 注册，复用 AppModule 即自动生效，此处仅保留过滤器与管道。
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

  await app.init();
  return app;
}
