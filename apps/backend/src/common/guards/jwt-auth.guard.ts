import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PUBLIC_META_KEY } from '../constants/rbac.constants';

/**
 * JWT 认证守卫。
 *
 * 作为全局 APP_GUARD 注册（必须在 PermissionGuard 之前），负责填充
 * `request.user`。命中 `@Public()` 的路由直接放行，不校验 token。
 *
 * 与 PermissionGuard 的协作：本守卫先执行认证，PermissionGuard 后执行授权。
 * 两者均读取 `@Public()` 元数据，公开路由在两处都短路返回 true。
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_META_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
