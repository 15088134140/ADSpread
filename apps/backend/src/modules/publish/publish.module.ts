import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DeviceApiModule } from '../device-api/device-api.module';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';

@Module({
  imports: [PrismaModule, DeviceApiModule],
  controllers: [PublishController],
  providers: [PublishService],
  exports: [PublishService],
})
export class PublishModule {}
