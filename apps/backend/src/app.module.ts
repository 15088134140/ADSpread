import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
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
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
