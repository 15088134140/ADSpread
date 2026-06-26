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

    // 按外键依赖顺序串行清理（依赖方先删）。
    // - operationLog/pushMessageLog 的 FK 均为 SetNull，可最先删；
    // - publishPlan/program/material 的 createdBy → Admin 为 Restrict，必须在 Admin 前删；
    // - admin → role 为 SetNull，role 在 admin 之后删；
    // - menu 自引用 parentId（Restrict），先解除父子关系再删。
    // 不能用 Promise.all 并发：PublishPlan/Program/Material 的 createdBy 指向 Admin
    // 且未声明 onDelete，默认 Restrict，并发删 Admin 会因这些表存在而失败。
    await this.operationLog.deleteMany({});
    await this.pushMessageLog.deleteMany({});
    await this.publishPlan.deleteMany({});
    await this.program.deleteMany({});
    await this.material.deleteMany({});
    await this.device.deleteMany({});
    await this.store.deleteMany({});
    await this.admin.deleteMany({});
    await this.role.deleteMany({});
    // menu 自引用 parentId 未声明 onDelete（默认 Restrict）：
    // 直接 deleteMany 会被现存父子关系阻塞，先断开 parentId 再删。
    await this.menu.updateMany({ where: { parentId: { not: null } }, data: { parentId: null } });
    await this.menu.deleteMany({});
  }
}
