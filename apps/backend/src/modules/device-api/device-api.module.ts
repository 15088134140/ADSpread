import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DeviceApiController } from './device-api.controller';
import { DeviceApiService } from './device-api.service';

@Module({
  imports: [PrismaModule],
  controllers: [DeviceApiController],
  providers: [DeviceApiService],
  exports: [DeviceApiService],
})
export class DeviceApiModule {}
