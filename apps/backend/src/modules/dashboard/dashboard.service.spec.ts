import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  const prisma = {
    device: { count: jest.fn() },
    material: { groupBy: jest.fn() },
    program: { groupBy: jest.fn() },
    publishPlan: { groupBy: jest.fn() },
    pushMessageLog: { count: jest.fn() },
    store: { count: jest.fn() },
    operationLog: { findMany: jest.fn() },
    role: { findUnique: jest.fn() },
    menu: { findMany: jest.fn() },
  } as unknown as PrismaService;

  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardService(prisma);

    // 默认：超级管理员角色 → hasPermission 直接返回 true（不走 menu 查询）
    (prisma.role.findUnique as jest.Mock).mockResolvedValue({
      name: '超级管理员',
      menuIds: [],
    });
    (prisma.menu.findMany as jest.Mock).mockResolvedValue([]);

    // 默认设备聚合：total=156, enabled=150, online=148, unbound=6
    (prisma.device.count as jest.Mock).mockImplementation(({ where }: any = {}) => {
      if (!where) return Promise.resolve(156);
      if (where.storeId === null) return Promise.resolve(6);
      if (where.status === 1 && where.lastActiveAt) return Promise.resolve(148);
      if (where.status === 1) return Promise.resolve(150);
      return Promise.resolve(0);
    });

    (prisma.material.groupBy as jest.Mock).mockResolvedValue([
      { auditStatus: 'PENDING', _count: { _all: 3 } },
      { auditStatus: 'APPROVED', _count: { _all: 320 } },
      { auditStatus: 'REJECTED', _count: { _all: 19 } },
    ]);

    (prisma.program.groupBy as jest.Mock).mockResolvedValue([
      { status: 0, _count: { _all: 12 } },
      { status: 1, _count: { _all: 8 } },
    ]);

    (prisma.publishPlan.groupBy as jest.Mock).mockResolvedValue([
      { status: 1, _count: { _all: 5 } },
      { status: 0, _count: { _all: 2 } },
    ]);

    // 默认推送：近 7 天 total=42, success=40
    (prisma.pushMessageLog.count as jest.Mock).mockImplementation(({ where }: any = {}) => {
      if (where && where.status === 1) return Promise.resolve(40);
      return Promise.resolve(42);
    });

    (prisma.store.count as jest.Mock).mockImplementation(({ where }: any = {}) => {
      if (where && where.status === 1) return Promise.resolve(22);
      return Promise.resolve(24);
    });

    (prisma.operationLog.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        username: 'admin',
        operation: '创建门店',
        status: 1,
        time: 120,
        createdAt: new Date('2026-06-26T03:00:00.000Z'),
      },
      {
        id: 2,
        username: 'ops',
        operation: '推送节目',
        status: 0,
        time: 55,
        createdAt: new Date('2026-06-26T02:00:00.000Z'),
      },
    ]);
  });

  it('aggregates all dimensions and maps fields correctly (super admin)', async () => {
    const result = await service.getOverview(1);

    // 设备：onlineRate = 148/150 = 0.987，offline = 150 - 148 = 2
    expect(result.device).toEqual({
      total: 156,
      enabled: 150,
      online: 148,
      offline: 2,
      unbound: 6,
      onlineRate: 0.987,
    });

    // 素材 / 节目 / 发布计划 groupBy 映射
    expect(result.material).toEqual({ pending: 3, approved: 320, rejected: 19 });
    expect(result.program).toEqual({ draft: 12, published: 8 });
    expect(result.publish).toEqual({
      active: 5,
      inactive: 2,
      recentPushTotal: 42,
      recentPushSuccess: 40,
      recentPushFail: 2,
      pushSuccessRate: 0.952,
    });

    // 门店
    expect(result.store).toEqual({ total: 24, active: 22 });

    // 待办字段映射
    expect(result.todo).toEqual({
      pendingMaterial: 3,
      pushFail: 2,
      unboundDevice: 6,
    });

    // 最近日志：time → durationMs，createdAt → ISO 字符串
    expect(result.recentLogs).toEqual([
      {
        id: 1,
        username: 'admin',
        operation: '创建门店',
        status: 1,
        durationMs: 120,
        createdAt: '2026-06-26T03:00:00.000Z',
      },
      {
        id: 2,
        username: 'ops',
        operation: '推送节目',
        status: 0,
        durationMs: 55,
        createdAt: '2026-06-26T02:00:00.000Z',
      },
    ]);

    // findMany 调用参数：按 createdAt desc，take 10，select 含 time
    const findManyArg = (prisma.operationLog.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyArg.orderBy).toEqual({ createdAt: 'desc' });
    expect(findManyArg.take).toBe(10);
    expect(findManyArg.select).toEqual({
      id: true,
      username: true,
      operation: true,
      status: true,
      time: true,
      createdAt: true,
    });
  });

  it('uses storeId: null for unbound device count and lastActiveAt gte for online', async () => {
    await service.getOverview(1);

    const countCalls = (prisma.device.count as jest.Mock).mock.calls.map(
      (c) => c[0],
    );
    // 未绑定：storeId: null
    expect(countCalls).toContainEqual({ where: { storeId: null } });
    // 启用：status: 1
    expect(countCalls).toContainEqual({ where: { status: 1 } });
    // 在线：status: 1 且 lastActiveAt 阈值
    const onlineCall = countCalls.find(
      (c) => c?.where?.status === 1 && c.where.lastActiveAt,
    );
    expect(onlineCall).toBeDefined();
    expect(onlineCall.where.lastActiveAt.gte).toBeInstanceOf(Date);
  });

  it('returns onlineRate 0 when enabled is 0', async () => {
    (prisma.device.count as jest.Mock).mockImplementation(({ where }: any = {}) => {
      if (!where) return Promise.resolve(10);
      if (where.storeId === null) return Promise.resolve(2);
      if (where.status === 1 && where.lastActiveAt) return Promise.resolve(0); // online
      if (where.status === 1) return Promise.resolve(0); // enabled
      return Promise.resolve(0);
    });

    const result = await service.getOverview(1);

    expect(result.device.enabled).toBe(0);
    expect(result.device.online).toBe(0);
    expect(result.device.offline).toBe(0);
    expect(result.device.onlineRate).toBe(0);
  });

  it('returns pushSuccessRate 0 when recentPushTotal is 0', async () => {
    (prisma.pushMessageLog.count as jest.Mock).mockImplementation(({ where }: any = {}) => {
      if (where && where.status === 1) return Promise.resolve(0);
      return Promise.resolve(0);
    });

    const result = await service.getOverview(1);

    expect(result.publish.recentPushTotal).toBe(0);
    expect(result.publish.recentPushSuccess).toBe(0);
    expect(result.publish.recentPushFail).toBe(0);
    expect(result.publish.pushSuccessRate).toBe(0);
    // todo.pushFail 等于 publish.recentPushFail
    expect(result.todo.pushFail).toBe(0);
  });

  it('returns empty recentLogs and does not call findMany when role does not exist (no log:list permission)', async () => {
    (prisma.role.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await service.getOverview(999);

    expect(result.recentLogs).toEqual([]);
    expect(prisma.operationLog.findMany).not.toHaveBeenCalled();
    // 其它聚合仍正常执行
    expect(result.device.total).toBe(156);
  });

  it('returns empty recentLogs when roleId is null/undefined', async () => {
    const result = await service.getOverview(undefined);

    expect(result.recentLogs).toEqual([]);
    expect(prisma.operationLog.findMany).not.toHaveBeenCalled();
    expect(prisma.role.findUnique).not.toHaveBeenCalled();
  });

  it('resolves log:list permission via menu permission set (non-super-admin)', async () => {
    (prisma.role.findUnique as jest.Mock).mockResolvedValue({
      name: '运营人员',
      menuIds: [10, 20],
    });
    (prisma.menu.findMany as jest.Mock).mockResolvedValue([
      { permission: 'log:list' },
      { permission: 'material:list' },
    ]);

    const result = await service.getOverview(2);

    // menu 查询按 menuIds + status=1
    const menuArg = (prisma.menu.findMany as jest.Mock).mock.calls[0][0];
    expect(menuArg.where).toEqual({ id: { in: [10, 20] }, status: 1 });
    expect(menuArg.select).toEqual({ permission: true });
    // 有权限 → findMany 被调用，time 映射为 durationMs
    expect(prisma.operationLog.findMany).toHaveBeenCalled();
    expect(result.recentLogs[0].durationMs).toBe(120);
  });

  it('does not call findMany when menu permission set lacks log:list', async () => {
    (prisma.role.findUnique as jest.Mock).mockResolvedValue({
      name: '运营人员',
      menuIds: [10],
    });
    (prisma.menu.findMany as jest.Mock).mockResolvedValue([
      { permission: 'material:list' },
    ]);

    const result = await service.getOverview(2);

    expect(result.recentLogs).toEqual([]);
    expect(prisma.operationLog.findMany).not.toHaveBeenCalled();
  });

  it('defaults all groupBy counts to 0 when groups are empty', async () => {
    (prisma.material.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.program.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.publishPlan.groupBy as jest.Mock).mockResolvedValue([]);

    const result = await service.getOverview(1);

    expect(result.material).toEqual({ pending: 0, approved: 0, rejected: 0 });
    expect(result.program).toEqual({ draft: 0, published: 0 });
    expect(result.publish.active).toBe(0);
    expect(result.publish.inactive).toBe(0);
    // todo.pendingMaterial 跟随 material.pending
    expect(result.todo.pendingMaterial).toBe(0);
  });
});
