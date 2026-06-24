import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') return;

    // Only for testing purposes
    const models = [
      this.operationLog,
      this.publishPlan,
      this.program,
      this.material,
      this.device,
      this.store,
      this.admin,
      this.role,
      this.menu,
    ];

    return Promise.all(models.map((model) => model.deleteMany({})));
  }
}
