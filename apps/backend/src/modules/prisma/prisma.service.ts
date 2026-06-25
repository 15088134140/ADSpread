import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') return;

    // Only for testing purposes
    return Promise.all([
      this.pushMessageLog.deleteMany({}),
      this.operationLog.deleteMany({}),
      this.publishPlan.deleteMany({}),
      this.program.deleteMany({}),
      this.material.deleteMany({}),
      this.device.deleteMany({}),
      this.store.deleteMany({}),
      this.admin.deleteMany({}),
      this.role.deleteMany({}),
      this.menu.deleteMany({}),
    ]);
  }
}
