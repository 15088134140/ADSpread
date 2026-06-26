import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../modules/prisma/prisma.service';
import {
  AUTHENTICATED_ONLY_META_KEY,
  PERMISSION_META_KEY,
  PUBLIC_META_KEY,
  SUPER_ADMIN_ROLE_NAME,
} from '../constants/rbac.constants';
import { BusinessErrorCode } from '../errors/business-error-codes';
import { BusinessException } from '../errors/business.exception';
import type { JwtUser } from '../decorators/current-user.decorator';

/**
 * 已加载并归一化的角色信息（仅保留权限决策需要的字段）。
 * menuIds 已规整为 number[]，避免 Json 字段脏数据。
 */
interface LoadedRole {
  id: number;
  name: string;
  menuIds: number[];
}

interface RequestWithUser extends Request {
  user?: JwtUser;
  /** 同一请求内缓存 role 查询结果，避免在守卫/拦截器/装饰器链中重复查库。 */
  _permissionGuardRole?: LoadedRole | null;
}

/**
 * 全局权限守卫（specs §5.2）。
 *
 * 决策顺序（命中即短路）：
 *  1. @Public() 放行
 *  2. 未登录 → 401
 *  3. 加载角色：roleId 为空 / 角色不存在 → 403；超级管理员角色放行
 *  4. @AuthenticatedOnly() 放行（仅需登录）
 *  5. @RequirePermission(code)：命中有效权限集合放行，否则 403
 *  6. 未声明任何权限标记 → 严格兜底 403
 *
 * 与 JwtAuthGuard 的协作：JwtAuthGuard 在控制器级 @UseGuards 注册，
 * 先于本全局守卫执行，负责填充 request.user；本守卫只做授权决策。
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const targets = [context.getHandler(), context.getClass()];

    // 1. 公开放行
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_META_KEY, targets)) {
      return true;
    }

    // 2. 未登录
    const user = request.user;
    if (!user) {
      throw new BusinessException('UNAUTHORIZED', [], BusinessErrorCode.UNAUTHORIZED, 401);
    }

    // 3. 加载角色：roleId 缺失 → 403
    const roleId = user.roleId;
    if (roleId === undefined || roleId === null) {
      throw new BusinessException('FORBIDDEN', [], BusinessErrorCode.FORBIDDEN, 403);
    }

    const role = await this.loadRole(request, roleId);
    if (!role) {
      // 角色已被删除或不存在
      throw new BusinessException('FORBIDDEN', [], BusinessErrorCode.FORBIDDEN, 403);
    }
    if (role.name === SUPER_ADMIN_ROLE_NAME) {
      return true;
    }

    // 4. 仅需登录放行
    if (this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_ONLY_META_KEY, targets)) {
      return true;
    }

    // 5. 权限码校验
    const code = this.reflector.getAllAndOverride<string>(PERMISSION_META_KEY, targets);
    if (code) {
      const permissionSet = await this.getPermissionSet(role.menuIds);
      if (permissionSet.has(code)) {
        return true;
      }
      throw new BusinessException('FORBIDDEN', [], BusinessErrorCode.FORBIDDEN, 403);
    }

    // 6. 严格兜底：未声明任何权限标记
    throw new BusinessException('FORBIDDEN', [], BusinessErrorCode.FORBIDDEN, 403);
  }

  /**
   * 加载角色并缓存到 request 上，避免同一请求多次查库。
   * menuIds 来自 Json 字段，做数组校验后规整。
   */
  private async loadRole(request: RequestWithUser, roleId: number): Promise<LoadedRole | null> {
    if (request._permissionGuardRole !== undefined) {
      return request._permissionGuardRole;
    }

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true, menuIds: true },
    });

    const loaded: LoadedRole | null = role
      ? {
          id: role.id,
          name: role.name,
          menuIds: Array.isArray(role.menuIds) ? (role.menuIds as number[]) : [],
        }
      : null;

    request._permissionGuardRole = loaded;
    return loaded;
  }

  /**
   * 计算用户有效权限码集合。
   * menuIds 已勾选到按钮级，无需递归子菜单；仅取启用状态(status=1)的菜单。
   */
  private async getPermissionSet(menuIds: number[]): Promise<Set<string>> {
    if (menuIds.length === 0) {
      return new Set<string>();
    }

    const menus = await this.prisma.menu.findMany({
      where: { id: { in: menuIds }, status: 1 },
      select: { permission: true },
    });

    return new Set(
      menus
        .map((m) => m.permission)
        .filter((p): p is string => typeof p === 'string' && p.length > 0)
    );
  }
}
