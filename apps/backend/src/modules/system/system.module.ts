import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminModule } from './admin/admin.module';
import { RoleModule } from './role/role.module';
import { MenuModule } from './menu/menu.module';
import { LogModule } from './log/log.module';

/**
 * 系统管理聚合模块（管理员 / 角色 / 菜单 / 操作日志）。
 *
 * 通过 re-export LogModule 暴露 OperationLogService（供 OperationLogInterceptor
 * 与 AuthService 复用），re-export MenuModule 暴露 MenuService（供 AuthService
 * 的 /api/auth/menus 复用）。AuthModule import 本模块即可同时获得两者，
 * 无循环依赖（本模块及其子模块均不 import AuthModule）。
 */
@Module({
  imports: [PrismaModule, AdminModule, RoleModule, MenuModule, LogModule],
  exports: [LogModule, MenuModule],
})
export class SystemModule {}
