import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { PrismaService } from '../../modules/prisma/prisma.service';
import {
  AUTHENTICATED_ONLY_META_KEY,
  PERMISSION_META_KEY,
  PUBLIC_META_KEY,
  SUPER_ADMIN_ROLE_NAME,
} from '../constants/rbac.constants';
import { BusinessErrorCode, type BusinessErrorCodeValue } from '../errors/business-error-codes';
import { BusinessException } from '../errors/business.exception';
import type { JwtUser } from '../decorators/current-user.decorator';

/**
 * 构造一个 mock ExecutionContext，持有给定 request。
 * handler/class 仅作为 Reflector 的查询目标占位，mock Reflector 不依赖它们。
 */
function createExecutionContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => 'mockHandler',
    getClass: () => 'MockClass',
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

/**
 * 构造一个 mock Reflector，按 metadataKey 返回预设值。
 * 多次调用同一 key 返回相同值（模拟 getAllAndOverride 的语义）。
 */
function createReflector(metadata: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) => metadata[key]),
  } as unknown as Reflector;
}

interface PrismaMockOptions {
  roleResult: { id: number; name: string; menuIds: unknown } | null;
  menusResult?: { permission: string | null }[];
}

/**
 * 构造一个 mock PrismaService，控制 role.findUnique 与 menu.findMany 的返回值。
 */
function createPrismaService(options: PrismaMockOptions): PrismaService {
  return {
    role: { findUnique: jest.fn().mockResolvedValue(options.roleResult) },
    menu: {
      findMany: jest.fn().mockResolvedValue(options.menusResult ?? []),
    },
  } as unknown as PrismaService;
}

function makeUser(overrides: Partial<JwtUser> = {}): JwtUser {
  return {
    id: 1,
    username: 'admin',
    name: '管理员',
    roleId: 10,
    ...overrides,
  };
}

/**
 * 断言 BusinessException 的状态码与业务码。
 */
function expectBusinessException(
  guardCall: Promise<boolean>,
  expectedStatus: number,
  expectedCode: BusinessErrorCodeValue
): Promise<void> {
  return expect(guardCall).rejects.toMatchObject({
    // HttpException.status 等价于构造时传入的 status
    status: expectedStatus,
    businessCode: expectedCode,
  });
}

describe('PermissionGuard', () => {
  // ===== 分支 1：@Public 放行（即使未登录也放行，且不查库） =====
  it('分支1：@Public 标记命中时放行，无需登录态且不访问数据库', async () => {
    const reflector = createReflector({ [PUBLIC_META_KEY]: true });
    const prisma = createPrismaService({ roleResult: null });
    const guard = new PermissionGuard(reflector, prisma);

    const ctx = createExecutionContext({ user: undefined });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.role.findUnique).not.toHaveBeenCalled();
    expect(prisma.menu.findMany).not.toHaveBeenCalled();
  });

  // ===== 分支 2：未登录 → 401 =====
  it('分支2：request.user 缺失时抛 401（UNAUTHORIZED）', async () => {
    const reflector = createReflector({});
    const prisma = createPrismaService({ roleResult: null });
    const guard = new PermissionGuard(reflector, prisma);

    const ctx = createExecutionContext({ user: undefined });
    await expectBusinessException(guard.canActivate(ctx), 401, BusinessErrorCode.UNAUTHORIZED);
    expect(prisma.role.findUnique).not.toHaveBeenCalled();
  });

  // ===== 分支 3：超级管理员角色放行 =====
  it('分支3：角色名称为超级管理员时放行，不校验权限码', async () => {
    const reflector = createReflector({});
    const prisma = createPrismaService({
      roleResult: { id: 10, name: SUPER_ADMIN_ROLE_NAME, menuIds: [] },
    });
    const guard = new PermissionGuard(reflector, prisma);

    const ctx = createExecutionContext({ user: makeUser() });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.role.findUnique).toHaveBeenCalledWith({
      where: { id: 10 },
      select: { id: true, name: true, menuIds: true },
    });
    // 超管短路，不应查菜单
    expect(prisma.menu.findMany).not.toHaveBeenCalled();
  });

  // ===== 分支 4：@AuthenticatedOnly 放行（仅需登录） =====
  it('分支4：@AuthenticatedOnly 命中且非超管时放行', async () => {
    const reflector = createReflector({ [AUTHENTICATED_ONLY_META_KEY]: true });
    const prisma = createPrismaService({
      roleResult: { id: 10, name: '普通管理员', menuIds: [] },
    });
    const guard = new PermissionGuard(reflector, prisma);

    const ctx = createExecutionContext({ user: makeUser() });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.role.findUnique).toHaveBeenCalled();
    expect(prisma.menu.findMany).not.toHaveBeenCalled();
  });

  // ===== 分支 5：@RequirePermission(code) 命中有效权限集合放行 =====
  it('分支5：权限码命中用户有效权限集合时放行', async () => {
    const reflector = createReflector({ [PERMISSION_META_KEY]: 'device:list' });
    const prisma = createPrismaService({
      roleResult: { id: 10, name: '普通管理员', menuIds: [1, 2] },
      menusResult: [{ permission: 'device:list' }, { permission: 'device:create' }],
    });
    const guard = new PermissionGuard(reflector, prisma);

    const ctx = createExecutionContext({ user: makeUser() });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.menu.findMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] }, status: 1 },
      select: { permission: true },
    });
  });

  // ===== 分支 6：@RequirePermission(code) 未命中 → 403 =====
  it('分支6：权限码未命中用户有效权限集合时抛 403（FORBIDDEN）', async () => {
    const reflector = createReflector({ [PERMISSION_META_KEY]: 'device:delete' });
    const prisma = createPrismaService({
      roleResult: { id: 10, name: '普通管理员', menuIds: [1, 2] },
      menusResult: [{ permission: 'device:list' }],
    });
    const guard = new PermissionGuard(reflector, prisma);

    const ctx = createExecutionContext({ user: makeUser() });
    await expectBusinessException(guard.canActivate(ctx), 403, BusinessErrorCode.FORBIDDEN);
  });

  // ===== 分支 7：未声明任何权限标记 → 严格兜底 403 =====
  it('分支7：未声明任何权限标记时抛 403（严格兜底）', async () => {
    const reflector = createReflector({});
    const prisma = createPrismaService({
      roleResult: { id: 10, name: '普通管理员', menuIds: [] },
    });
    const guard = new PermissionGuard(reflector, prisma);

    const ctx = createExecutionContext({ user: makeUser() });
    await expectBusinessException(guard.canActivate(ctx), 403, BusinessErrorCode.FORBIDDEN);
    // 兜底短路前不应查菜单
    expect(prisma.menu.findMany).not.toHaveBeenCalled();
  });

  // ===== 补充：roleId 为空 → 403 =====
  it('补充：request.user.roleId 为空时抛 403', async () => {
    const reflector = createReflector({});
    const prisma = createPrismaService({ roleResult: null });
    const guard = new PermissionGuard(reflector, prisma);

    const ctx = createExecutionContext({
      user: makeUser({ roleId: undefined }),
    });
    await expectBusinessException(guard.canActivate(ctx), 403, BusinessErrorCode.FORBIDDEN);
    expect(prisma.role.findUnique).not.toHaveBeenCalled();
  });

  // ===== 补充：角色已被删除（findUnique 返回 null）→ 403 =====
  it('补充：角色不存在（已被删除）时抛 403', async () => {
    const reflector = createReflector({ [PERMISSION_META_KEY]: 'device:list' });
    const prisma = createPrismaService({ roleResult: null });
    const guard = new PermissionGuard(reflector, prisma);

    const ctx = createExecutionContext({ user: makeUser() });
    await expectBusinessException(guard.canActivate(ctx), 403, BusinessErrorCode.FORBIDDEN);
  });

  // ===== 补充：menuIds 为空数组时不查菜单，权限集合为空 =====
  it('补充：role.menuIds 为空时跳过菜单查询，权限码必然未命中 → 403', async () => {
    const reflector = createReflector({ [PERMISSION_META_KEY]: 'device:list' });
    const prisma = createPrismaService({
      roleResult: { id: 10, name: '普通管理员', menuIds: [] },
    });
    const guard = new PermissionGuard(reflector, prisma);

    const ctx = createExecutionContext({ user: makeUser() });
    await expectBusinessException(guard.canActivate(ctx), 403, BusinessErrorCode.FORBIDDEN);
    expect(prisma.menu.findMany).not.toHaveBeenCalled();
  });

  // ===== 补充：menuIds 为 null（Json 脏数据）时规整为空数组 =====
  it('补充：role.menuIds 为 null 时规整为空数组', async () => {
    const reflector = createReflector({ [PERMISSION_META_KEY]: 'device:list' });
    const prisma = createPrismaService({
      roleResult: { id: 10, name: '普通管理员', menuIds: null },
    });
    const guard = new PermissionGuard(reflector, prisma);

    const ctx = createExecutionContext({ user: makeUser() });
    await expectBusinessException(guard.canActivate(ctx), 403, BusinessErrorCode.FORBIDDEN);
    expect(prisma.menu.findMany).not.toHaveBeenCalled();
  });

  // ===== 补充：菜单权限字段为空字符串/null 时被过滤 =====
  it('补充：菜单 permission 为空字符串或 null 时不进入权限集合', async () => {
    const reflector = createReflector({ [PERMISSION_META_KEY]: 'device:list' });
    const prisma = createPrismaService({
      roleResult: { id: 10, name: '普通管理员', menuIds: [1, 2, 3] },
      menusResult: [{ permission: null }, { permission: '' }, { permission: 'device:list' }],
    });
    const guard = new PermissionGuard(reflector, prisma);

    const ctx = createExecutionContext({ user: makeUser() });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  // ===== 补充：同一请求内 role 查询结果被缓存，不重复查库 =====
  it('补充：同一 request 上多次 canActivate 只查一次 role', async () => {
    const reflector = createReflector({ [AUTHENTICATED_ONLY_META_KEY]: true });
    const prisma = createPrismaService({
      roleResult: { id: 10, name: '普通管理员', menuIds: [] },
    });
    const guard = new PermissionGuard(reflector, prisma);

    const request = { user: makeUser() };
    const ctx = createExecutionContext(request);

    await guard.canActivate(ctx);
    await guard.canActivate(ctx);

    expect(prisma.role.findUnique).toHaveBeenCalledTimes(1);
  });

  // ===== 补充：BusinessException 携带正确的中文 message =====
  it('补充：401 异常 message 为"未登录"，403 异常 message 为"无权限访问"', async () => {
    const guard401 = new PermissionGuard(
      createReflector({}),
      createPrismaService({ roleResult: null })
    );
    const ctx401 = createExecutionContext({ user: undefined });
    await expect(guard401.canActivate(ctx401)).rejects.toBeInstanceOf(BusinessException);
    try {
      await guard401.canActivate(createExecutionContext({ user: undefined }));
      throw new Error('should have thrown');
    } catch (e) {
      const err = e as BusinessException;
      expect(err.message).toBe('未登录');
      expect(err.businessCode).toBe(BusinessErrorCode.UNAUTHORIZED);
    }

    const guard403 = new PermissionGuard(
      createReflector({}),
      createPrismaService({
        roleResult: { id: 10, name: '普通管理员', menuIds: [] },
      })
    );
    try {
      await guard403.canActivate(createExecutionContext({ user: makeUser() }));
      throw new Error('should have thrown');
    } catch (e) {
      const err = e as BusinessException;
      expect(err.message).toBe('无权限访问');
      expect(err.businessCode).toBe(BusinessErrorCode.FORBIDDEN);
    }
  });
});
