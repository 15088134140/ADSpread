import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { DeviceApiController } from './device-api.controller';
import { DeviceApiService } from './device-api.service';
import { DeviceTokenService } from './auth/device-token.service';
import { DeviceGuard } from './guards/device.guard';
import { DeviceGateway } from './gateway/device.gateway';
import { CommandDispatchService } from './service/command-dispatch.service';

@Module({
  imports: [
    PrismaModule,
    // 复用与 AuthModule 相同的 secret（plan §K1），device token 有效期 90d。
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'adspread-dev-secret',
      signOptions: { expiresIn: '90d' },
    }),
  ],
  controllers: [DeviceApiController],
  providers: [
    DeviceApiService,
    DeviceTokenService,
    DeviceGuard,
    DeviceGateway,
    CommandDispatchService,
  ],
  // CommandDispatchService 暴露供后续管理后台模块调用下发指令
  exports: [DeviceApiService, DeviceTokenService, CommandDispatchService],
})
export class DeviceApiModule {}
