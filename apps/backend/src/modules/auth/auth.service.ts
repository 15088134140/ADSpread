import { Injectable, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from '../system/log/operation-log.service';
import { MenuService } from '../system/menu/menu.service';
import { BusinessException } from '../../common/errors/business.exception';
import { BusinessErrorCode } from '../../common/errors/business-error-codes';
import { STATUS_ENABLED } from '../../common/constants/business.constants';
import { SUPER_ADMIN_ROLE_NAME } from '../../common/constants/rbac.constants';
import {
  PASSWORD_STRENGTH_REGEX,
  PASSWORD_STRENGTH_MESSAGE,
} from '../system/admin/dto/create-admin.dto';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

const BCRYPT_ROUNDS = 12;

/**
 * 管理员公开字段：永远排除 passwordHash。
 * 与 AdminService.ADMIN_PUBLIC_SELECT 保持一致。
 */
const ADMIN_PUBLIC_SELECT = {
  id: true,
  username: true,
  name: true,
  roleId: true,
  status: true,
  avatar: true,
  phone: true,
  email: true,
  lastLoginAt: true,
  lastLoginIp: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
} satisfies Prisma.AdminSelect;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly operationLogService: OperationLogService,
    private readonly menuService: MenuService
  ) {}

  async login(username: string, password: string, ip?: string, userAgent?: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { username },
      include: { role: true },
    });

    if (!admin) {
      throw new BusinessException(
        '用户名或密码错误',
        BusinessErrorCode.UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED
      );
    }

    if (admin.status !== STATUS_ENABLED) {
      throw new BusinessException('账号已禁用', BusinessErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }

    const passwordOk = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordOk) {
      throw new BusinessException(
        '用户名或密码错误',
        BusinessErrorCode.UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED
      );
    }

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    const token = await this.jwtService.signAsync({
      sub: admin.id,
      username: admin.username,
      name: admin.name,
      roleId: admin.roleId,
    });

    // 登录为 @Public 路由，拦截器覆盖不到，此处显式写 login 操作日志（仅成功写）。
    await this.operationLogService.create({
      adminId: admin.id,
      username: admin.username,
      operation: 'login',
      method: 'POST',
      ip,
      userAgent,
      status: 1,
      time: 0,
      roleId: admin.roleId,
    });

    const { passwordHash, ...userInfo } = admin;

    return {
      token,
      userInfo,
    };
  }

  /**
   * 登出：JWT 无状态，服务端仅记录 logout 日志；前端清除 token。
   */
  async logout(user: JwtUser, ip?: string, userAgent?: string) {
    await this.operationLogService.create({
      adminId: user.id,
      username: user.username,
      operation: 'logout',
      method: 'POST',
      ip,
      userAgent,
      status: 1,
      time: 0,
      roleId: user.roleId ?? null,
    });
    return { success: true };
  }

  /**
   * 返回当前管理员信息（含角色，不含 passwordHash）。
   */
  async me(userId: number) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: userId },
      select: ADMIN_PUBLIC_SELECT,
    });
    if (!admin) {
      throw new BusinessException('用户不存在', BusinessErrorCode.NOT_FOUND, 404);
    }
    return admin;
  }

  /**
   * 返回当前用户可见菜单树（specs §5.5）。
   * 超级管理员返回全部启用菜单；普通用户按 role.menuIds + 祖先过滤。
   */
  async menus(user: JwtUser) {
    const roleId = user.roleId;
    if (roleId === undefined || roleId === null) {
      throw new BusinessException('无权限访问', BusinessErrorCode.FORBIDDEN, 403);
    }

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { name: true, menuIds: true },
    });
    if (!role) {
      throw new BusinessException('无权限访问', BusinessErrorCode.FORBIDDEN, 403);
    }

    const isSuperAdmin = role.name === SUPER_ADMIN_ROLE_NAME;
    const menuIds = Array.isArray(role.menuIds) ? (role.menuIds as number[]) : [];
    return this.menuService.findUserTree(menuIds, isSuperAdmin);
  }

  /**
   * 修改自己的密码：校验旧密码，新密码需符合强度规则。
   */
  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id: userId } });
    if (!admin) {
      throw new BusinessException('用户不存在', BusinessErrorCode.NOT_FOUND, 404);
    }

    const oldOk = await bcrypt.compare(oldPassword, admin.passwordHash);
    if (!oldOk) {
      throw new BusinessException('旧密码错误', BusinessErrorCode.PARAM_ERROR);
    }

    if (!PASSWORD_STRENGTH_REGEX.test(newPassword)) {
      throw new BusinessException(PASSWORD_STRENGTH_MESSAGE, BusinessErrorCode.PARAM_ERROR);
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.admin.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { id: userId };
  }
}
