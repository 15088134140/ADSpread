import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminModule } from './admin/admin.module';
import { RoleModule } from './role/role.module';
import { MenuModule } from './menu/menu.module';
import { LogModule } from './log/log.module';

/**
 * 系统管理聚合模块（管理员 / 角色 / 菜单 / 操作日志）。
 *
 * 注意：本模块暂不在 AppModule 注册——由 Task 7 统一注册 SystemModule
 * 与全局 OperationLogInterceptor，避免半注册状态。
 *
 * 通过 re-export LogModule 暴露 OperationLogService，供 auth 模块（Task 7）
 * 与 OperationLogInterceptor 复用。
 */
@Module({
  imports: [PrismaModule, AdminModule, RoleModule, MenuModule, LogModule],
  exports: [LogModule],
})
export class SystemModule {}
