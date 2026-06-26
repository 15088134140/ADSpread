import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

// 全局支持 BigInt 序列化（Material.fileSize 等字段）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  // Serve static files from uploads directory
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Global exception filter
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  // 全局守卫（JwtAuthGuard + PermissionGuard）与全局拦截器
  // （TransformInterceptor + OperationLogInterceptor）统一通过 AppModule 的
  // APP_GUARD / APP_INTERCEPTOR provider 注册，此处不再 useGlobalInterceptors。

  // Logging middleware is registered via AppModule (consumer.apply)

  // Swagger documentation
  if (process.env.SWAGGER_ENABLED !== 'false') {
    const config = new DocumentBuilder()
      .setTitle('ADSpread API')
      .setDescription('信发系统 API 文档')
      .setVersion('1.3.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(process.env.SWAGGER_PATH || '/api/docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 ADSpread backend is running on http://localhost:${port}`);
  console.log(`📚 API docs: http://localhost:${port}/api/docs`);
}

void bootstrap();
