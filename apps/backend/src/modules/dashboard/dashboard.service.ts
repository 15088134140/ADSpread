import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SUPER_ADMIN_ROLE_NAME } from '../../common/constants/rbac.constants';
import {
  DashboardOverview,
  DashboardRecentLog,
} from './dto/dashboard-overview.dto';

/**
 * 设备在线判定阈值（秒）：lastActiveAt >= now - 5min 视为在线。
 * 约定常量，不暴露为配置项（符合"不引入未被要求的配置项"原则）。
 */
const ONLINE_THRESHOLD_SECONDS = 300;

/**
 * 推送统计回溯窗口（毫秒）：近 7 天。
 */
const PUSH_RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 最近操作日志取数条数。
 */
const RECENT_LOGS_TAKE = 10;

/**
 * operationLog.findMany 的原始行结构（仅取概览需要的字段）。
 */
interface OperationLogRecentRaw {
  id: number;
  username: string;
  operation: string;
  status: number;
  time: number;
  createdAt: Date;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 聚合仪表盘概览数据。
   *
   * @param roleId 当前登录用户的 roleId，用于判定 log:list 权限以裁剪 recentLogs。
   */
  async getOverview(roleId: number | null | undefined): Promise<DashboardOverview> {
    const canViewLogs = await this.hasPermission(roleId, 'log:list');

    const now = Date.now();
    const onlineThreshold = new Date(now - ONLINE_THRESHOLD_SECONDS * 1000);
    const pushSince = new Date(now - PUSH_RECENT_WINDOW_MS);

    const [
      deviceTotal,
      deviceEnabled,
      deviceOnline,
      deviceUnbound,
      materialGroups,
      programGroups,
      publishGroups,
      recentPushTotal,
      recentPushSuccess,
      storeTotal,
      storeActive,
      recentLogsRaw,
    ] = await Promise.all([
      this.prisma.device.count(),
      this.prisma.device.count({ where: { status: 1 } }),
      this.prisma.device.count({
        where: { status: 1, lastActiveAt: { gte: onlineThreshold } },
      }),
      this.prisma.device.count({ where: { storeId: null } }),
      this.prisma.material.groupBy({ by: ['auditStatus'], _count: { _all: true } }),
      this.prisma.program.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.publishPlan.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.pushMessageLog.count({ where: { createdAt: { gte: pushSince } } }),
      this.prisma.pushMessageLog.count({
        where: { createdAt: { gte: pushSince }, status: 1 },
      }),
      this.prisma.store.count(),
      this.prisma.store.count({ where: { status: 1 } }),
      canViewLogs
        ? this.prisma.operationLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: RECENT_LOGS_TAKE,
            select: {
              id: true,
              username: true,
              operation: true,
              status: true,
              time: true,
              createdAt: true,
            },
          })
        : Promise.resolve([] as OperationLogRecentRaw[]),
    ]);

    // 设备
    const offline = deviceEnabled - deviceOnline;
    const onlineRate =
      deviceEnabled > 0 ? Number((deviceOnline / deviceEnabled).toFixed(3)) : 0;

    // 素材审核状态分布
    const materialMap = new Map(
      materialGroups.map((g) => [g.auditStatus, g._count._all] as const),
    );
    const material = {
      pending: materialMap.get('PENDING') ?? 0,
      approved: materialMap.get('APPROVED') ?? 0,
      rejected: materialMap.get('REJECTED') ?? 0,
    };

    // 节目状态分布
    const programMap = new Map(
      programGroups.map((g) => [g.status, g._count._all] as const),
    );
    const program = {
      draft: programMap.get(0) ?? 0,
      published: programMap.get(1) ?? 0,
    };

    // 发布计划状态分布 + 推送统计
    const publishMap = new Map(
      publishGroups.map((g) => [g.status, g._count._all] as const),
    );
    const recentPushFail = recentPushTotal - recentPushSuccess;
    const pushSuccessRate =
      recentPushTotal > 0
        ? Number((recentPushSuccess / recentPushTotal).toFixed(3))
        : 0;
    const publish = {
      active: publishMap.get(1) ?? 0,
      inactive: publishMap.get(0) ?? 0,
      recentPushTotal,
      recentPushSuccess,
      recentPushFail,
      pushSuccessRate,
    };

    // 门店
    const store = { total: storeTotal, active: storeActive };

    // 运营待办
    const todo = {
      pendingMaterial: material.pending,
      pushFail: publish.recentPushFail,
      unboundDevice: deviceUnbound,
    };

    // 最近操作日志（time → durationMs，createdAt → ISO 字符串）
    const recentLogs: DashboardRecentLog[] = recentLogsRaw.map((log) => ({
      id: log.id,
      username: log.username,
      operation: log.operation,
      status: log.status,
      durationMs: log.time,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      device: {
        total: deviceTotal,
        enabled: deviceEnabled,
        online: deviceOnline,
        offline,
        unbound: deviceUnbound,
        onlineRate,
      },
      material,
      program,
      publish,
      store,
      todo,
      recentLogs,
    };
  }

  /**
   * 判定当前用户角色是否拥有指定权限码。
   *
   * 复用 PermissionGuard 的解析逻辑（roleId → 角色 → menuIds → 启用菜单的 permission 集合），
   * 不新建权限解析路径。JwtUser 不含权限集合，故在此按 roleId 推导。
   */
  private async hasPermission(
    roleId: number | null | undefined,
    code: string,
  ): Promise<boolean> {
    if (roleId === null || roleId === undefined) {
      return false;
    }

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { name: true, menuIds: true },
    });
    if (!role) {
      return false;
    }
    if (role.name === SUPER_ADMIN_ROLE_NAME) {
      return true;
    }

    const menuIds = Array.isArray(role.menuIds) ? (role.menuIds as number[]) : [];
    if (menuIds.length === 0) {
      return false;
    }

    const menus = await this.prisma.menu.findMany({
      where: { id: { in: menuIds }, status: 1 },
      select: { permission: true },
    });
    const permissionSet = new Set(
      menus
        .map((m) => m.permission)
        .filter((p): p is string => typeof p === 'string' && p.length > 0),
    );
    return permissionSet.has(code);
  }
}
