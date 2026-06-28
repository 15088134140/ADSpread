import * as fs from 'fs';
import { DeviceApiService } from './device-api.service';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceTokenService } from './auth/device-token.service';
import type { DeviceIdentity } from './decorators/current-device.decorator';

describe('DeviceApiService', () => {
  const prisma = {
    device: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    store: { findFirst: jest.fn() },
    publishPlan: { findMany: jest.fn(), findUnique: jest.fn() },
    program: { findMany: jest.fn(), findUnique: jest.fn() },
    material: { findMany: jest.fn() },
    deviceLog: { create: jest.fn() },
    deviceCommand: { findFirst: jest.fn(), update: jest.fn() },
  } as unknown as PrismaService;

  const deviceTokenService = {
    issue: jest.fn(),
  } as unknown as DeviceTokenService;

  let service: DeviceApiService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeviceApiService(prisma, deviceTokenService);
  });

  it('returns current program for device', async () => {
    const deviceCode = 'TEST_DEVICE_001';
    const deviceId = 1;
    const storeId = 1;

    (prisma.device.findFirst as jest.Mock).mockResolvedValue({
      id: deviceId,
      storeId: storeId,
      screenOrientation: 'LANDSCAPE',
      splitType: 'SPLIT_1',
      screenResolution: '1920x1080',
      status: 1, // 确保设备是启用状态
    });

    (prisma.store.findFirst as jest.Mock).mockResolvedValue({
      id: storeId,
      name: 'Test Store',
      status: 1,
    });

    // 根据当前日期计算需要包含的星期几
    const today = new Date();
    const currentDay = today.getDay() || 7; // 0是周日，改为7

    // 模拟发布计划返回多个计划，以便进行过滤
    (prisma.publishPlan.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        programId: 1,
        targetStoreIds: [100], // 不是设备所在门店
        status: 1,
        playDays: [6, 7], // 周末播放
        startTime: '2024-01-01 00:00:00',
        endTime: '2024-01-31 23:59:59',
        program: {
          id: 1,
          name: 'Not Target Program',
          screenOrientation: 'LANDSCAPE',
          splitType: 'SPLIT_1',
          status: 1,
          layoutConfig: { regions: [] },
        },
      },
      {
        id: 2,
        programId: 1,
        targetStoreIds: [storeId],
        status: 1,
        playDays: [1, 2, 3, 4, 5, currentDay], // 包含当前日期的播放天
        startTime: '2024-01-01 00:00:00',
        endTime: '2024-01-31 23:59:59',
        program: {
          id: 1,
          name: 'Test Program',
          screenOrientation: 'LANDSCAPE',
          splitType: 'SPLIT_1',
          status: 1,
          layoutConfig: {
            regions: [
              {
                regionId: 'region1',
                materials: [{ materialId: 1, duration: 10 }],
              },
            ],
          },
        },
      },
    ]);

    (prisma.program.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      name: 'Test Program',
      screenOrientation: 'LANDSCAPE',
      splitType: 'SPLIT_1',
      status: 1,
      layoutConfig: {
        regions: [
          {
            regionId: 'region1',
            materials: [{ materialId: 1, duration: 10 }],
          },
        ],
      },
    });

    (prisma.material.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        name: 'Test Material',
        fileUrl: '/uploads/test.jpg',
        type: 'IMAGE',
      },
    ]);

    const result = await service.getCurrentProgram(deviceCode);
    console.log('=== Test result ===');
    console.log('Type:', typeof result);
    console.log('Value:', result);

    expect(result).toBeDefined();
    if (result) {
      expect(result.name).toBe('Test Program');
      expect(result.screenOrientation).toBe('LANDSCAPE');
      expect(result.splitType).toBe('SPLIT_1');
    }
  });

  it('assigns per-region bounds by index for SPLIT_2 landscape (B1 regression)', async () => {
    const deviceCode = 'TEST_DEVICE_SPLIT2';
    const storeId = 2;

    (prisma.device.findFirst as jest.Mock).mockResolvedValue({
      id: 2,
      storeId,
      screenOrientation: 'LANDSCAPE',
      splitType: 'SPLIT_2',
      screenResolution: '1920x1080',
      status: 1,
    });

    (prisma.store.findFirst as jest.Mock).mockResolvedValue({
      id: storeId,
      name: 'Split Store',
      status: 1,
    });

    (prisma.publishPlan.findMany as jest.Mock).mockResolvedValue([
      {
        id: 10,
        programId: 20,
        targetStoreIds: [storeId],
        status: 1,
        playDays: [1, 2, 3, 4, 5, 6, 7], // 覆盖全部星期，确保命中当天
        startTime: '2024-01-01 00:00:00',
        endTime: '2024-12-31 23:59:59',
        program: {
          id: 20,
          name: 'Split2 Program',
          screenOrientation: 'LANDSCAPE',
          // 故意与设备不同，验证 applyForcedSplit 用设备配置覆盖
          splitType: 'SPLIT_1',
          status: 1,
          layoutConfig: {
            regions: [
              { regionId: 'region1', materials: [{ materialId: 101, duration: 10 }] },
              { regionId: 'region2', materials: [{ materialId: 102, duration: 20 }] },
            ],
          },
        },
      },
    ]);

    (prisma.material.findMany as jest.Mock).mockResolvedValue([
      { id: 101, name: 'Mat A', fileUrl: '/uploads/a.jpg', type: 'IMAGE' },
      { id: 102, name: 'Mat B', fileUrl: '/uploads/b.jpg', type: 'IMAGE' },
    ]);

    const result = await service.getCurrentProgram(deviceCode);

    expect(result).toBeDefined();
    if (result) {
      // 设备配置覆盖节目配置
      expect(result.splitType).toBe('SPLIT_2');
      expect(result.screenOrientation).toBe('LANDSCAPE');

      const regions = result.layoutConfig.regions;
      expect(regions).toHaveLength(2);

      // B1 修复关键断言：每个 region 拿到对应索引的单个 bounds 对象，而非整个 bounds 数组
      expect(Array.isArray(regions[0].bounds)).toBe(false);
      expect(Array.isArray(regions[1].bounds)).toBe(false);

      expect(regions[0].bounds).toEqual({
        regionId: 'region1',
        x: 0,
        y: 0,
        width: 0.5,
        height: 1,
      });
      expect(regions[1].bounds).toEqual({
        regionId: 'region2',
        x: 0.5,
        y: 0,
        width: 0.5,
        height: 1,
      });
    }
  });

  describe('bind', () => {
    const baseDevice = {
      id: 10,
      code: 'DEVICE_BIND_001',
      storeId: 7,
      status: 1,
      screenOrientation: 'LANDSCAPE',
      splitType: 'SPLIT_2',
      screenResolution: '1920x1080',
    };

    const hardwareInfo = {
      mac: 'AA:BB:CC:DD:EE:FF',
      appVersion: '1.2.3',
      resolution: '3840x2160',
    };

    it('returns deviceToken, storeId and deviceConfig on success', async () => {
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(baseDevice);
      (prisma.device.update as jest.Mock).mockResolvedValue(baseDevice);
      (deviceTokenService.issue as jest.Mock).mockResolvedValue('mock-device-token');

      const result = await service.bind(baseDevice.code, hardwareInfo, '203.0.113.5');

      expect(result).toEqual({
        deviceToken: 'mock-device-token',
        storeId: 7,
        deviceConfig: {
          screenOrientation: 'LANDSCAPE',
          splitType: 'SPLIT_2',
          // hardwareInfo.resolution 覆盖设备原分辨率
          screenResolution: '3840x2160',
        },
      });
      expect(deviceTokenService.issue).toHaveBeenCalledWith({
        id: 10,
        code: 'DEVICE_BIND_001',
      });
    });

    it('returns null storeId when device has no bound store', async () => {
      const unboundDevice = { ...baseDevice, storeId: null };
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(unboundDevice);
      (prisma.device.update as jest.Mock).mockResolvedValue(unboundDevice);
      (deviceTokenService.issue as jest.Mock).mockResolvedValue('tok');

      const result = await service.bind(baseDevice.code, {});

      expect(result.storeId).toBeNull();
    });

    it('throws DEVICE_NOT_FOUND when code does not exist', async () => {
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.bind('MISSING_CODE', {})).rejects.toMatchObject({
        messageKey: 'DEVICE_NOT_FOUND',
      });
      expect(prisma.device.update).not.toHaveBeenCalled();
      expect(deviceTokenService.issue).not.toHaveBeenCalled();
    });

    it('throws DEVICE_DISABLED_OR_NOT_FOUND when device is disabled', async () => {
      (prisma.device.findFirst as jest.Mock).mockResolvedValue({ ...baseDevice, status: 0 });

      await expect(service.bind(baseDevice.code, {})).rejects.toMatchObject({
        messageKey: 'DEVICE_DISABLED_OR_NOT_FOUND',
      });
      expect(prisma.device.update).not.toHaveBeenCalled();
      expect(deviceTokenService.issue).not.toHaveBeenCalled();
    });

    it('writes hardwareInfo into device table', async () => {
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(baseDevice);
      (prisma.device.update as jest.Mock).mockResolvedValue(baseDevice);
      (deviceTokenService.issue as jest.Mock).mockResolvedValue('tok');

      await service.bind(baseDevice.code, hardwareInfo, '203.0.113.5');

      expect(prisma.device.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          macAddress: 'AA:BB:CC:DD:EE:FF',
          appVersion: '1.2.3',
          screenResolution: '3840x2160',
          ipAddress: '203.0.113.5',
        },
      });
    });
  });

  describe('sync', () => {
    const storeId = 7;
    const device = { id: 1, code: 'D1', storeId } as DeviceIdentity;

    const planUpdatedAt = new Date('2026-01-01T00:00:00Z');
    const programUpdatedAt = new Date('2026-01-02T00:00:00Z');
    const materialUpdatedAt = new Date('2026-01-03T00:00:00Z');
    // version = max(plan, program, material updatedAt) 毫秒戳
    const expectedVersion = String(materialUpdatedAt.getTime());

    /** 构造一条命中本门店的计划 + 一条其他门店的计划（应被过滤）+ 一个 APPROVED 素材。 */
    const setupHappyPath = () => {
      (prisma.publishPlan.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          programId: 10,
          targetStoreIds: [storeId],
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: null,
          playDays: [1, 2, 3, 4, 5],
          status: 1,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: planUpdatedAt,
          program: {
            id: 10,
            name: 'Prog A',
            screenOrientation: 'LANDSCAPE',
            splitType: 'SPLIT_1',
            status: 1,
            layoutConfig: {
              regions: [{ regionId: 'r1', materials: [{ materialId: 101, duration: 10 }] }],
            },
            updatedAt: programUpdatedAt,
          },
        },
        {
          // 其他门店计划，应被 targetStoreIds 过滤掉
          id: 2,
          programId: 20,
          targetStoreIds: [999],
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: null,
          playDays: [6, 7],
          status: 1,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2025-12-31T00:00:00Z'),
          program: {
            id: 20,
            name: 'Prog Other',
            screenOrientation: 'LANDSCAPE',
            splitType: 'SPLIT_1',
            status: 1,
            layoutConfig: {
              regions: [{ regionId: 'r1', materials: [{ materialId: 200, duration: 5 }] }],
            },
            updatedAt: new Date('2025-12-31T00:00:00Z'),
          },
        },
      ]);
      (prisma.material.findMany as jest.Mock).mockResolvedValue([
        {
          id: 101,
          name: 'Mat A',
          type: 'IMAGE',
          fileUrl: '/uploads/materials/a.jpg',
          fileSize: BigInt(1048576),
          fileExtension: 'jpg',
          width: 1920,
          height: 1080,
          duration: null,
          thumbnailUrl: null,
          updatedAt: materialUpdatedAt,
        },
      ]);
    };

    it('returns empty set with version 0 when device has no bound store', async () => {
      const unbound = { id: 1, code: 'D1', storeId: null } as DeviceIdentity;
      const result = await service.sync(unbound);

      expect(result.version).toBe('0');
      expect(result.notModified).toBe(false);
      expect(result.plans).toEqual([]);
      expect(result.programs).toEqual([]);
      expect(result.materials).toEqual([]);
      // 未绑定不查库
      expect(prisma.publishPlan.findMany).not.toHaveBeenCalled();
    });

    it('returns notModified when unbound device sends etag=0', async () => {
      const unbound = { id: 1, code: 'D1', storeId: null } as DeviceIdentity;
      const result = await service.sync(unbound, '0');

      expect(result.version).toBe('0');
      expect(result.notModified).toBe(true);
      expect(result.materials).toEqual([]);
    });

    it('computes version from max updatedAt of plans/programs/materials', async () => {
      setupHappyPath();
      const result = await service.sync(device);

      expect(result.version).toBe(expectedVersion);
      expect(result.notModified).toBe(false);
    });

    it('returns notModified with empty arrays when etag matches computed version', async () => {
      setupHappyPath();
      const result = await service.sync(device, expectedVersion);

      expect(result.notModified).toBe(true);
      expect(result.version).toBe(expectedVersion);
      expect(result.plans).toEqual([]);
      expect(result.programs).toEqual([]);
      expect(result.materials).toEqual([]);
    });

    it('filters plans by targetStoreIds and returns full DTO shape', async () => {
      setupHappyPath();
      const result = await service.sync(device);

      // 其他门店计划被过滤，仅剩 1 条
      expect(result.plans).toHaveLength(1);
      expect(result.plans[0]).toEqual({
        id: 1,
        programId: 10,
        targetStoreIds: [storeId],
        startTime: new Date('2026-01-01T00:00:00Z'),
        endTime: null,
        playDays: [1, 2, 3, 4, 5],
        status: 1,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });

      expect(result.programs).toHaveLength(1);
      expect(result.programs[0]).toEqual({
        id: 10,
        name: 'Prog A',
        screenOrientation: 'LANDSCAPE',
        splitType: 'SPLIT_1',
        layoutConfig: {
          regions: [{ regionId: 'r1', materials: [{ materialId: 101, duration: 10 }] }],
        },
        status: 1,
      });

      expect(result.materials).toHaveLength(1);
      expect(result.materials[0]).toEqual({
        id: 101,
        name: 'Mat A',
        type: 'IMAGE',
        fileUrl: '/uploads/materials/a.jpg',
        fileSize: '1048576',
        fileExtension: 'jpg',
        width: 1920,
        height: 1080,
        duration: null,
        thumbnailUrl: null,
      });
    });

    it('serializes material fileSize (BigInt) as string', async () => {
      setupHappyPath();
      const result = await service.sync(device);

      expect(result.materials[0].fileSize).toBe('1048576');
      expect(typeof result.materials[0].fileSize).toBe('string');
    });

    it('queries only APPROVED materials with the collected materialIds', async () => {
      setupHappyPath();
      await service.sync(device);

      expect(prisma.material.findMany).toHaveBeenCalledWith({
        where: { id: { in: [101] }, auditStatus: 'APPROVED' },
      });
    });

    it('excludes draft programs (status=0) from programs[] and skips their materials', async () => {
      (prisma.publishPlan.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          programId: 10,
          targetStoreIds: [storeId],
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: null,
          playDays: [1, 2, 3, 4, 5],
          status: 1,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: planUpdatedAt,
          program: {
            id: 10,
            name: 'Draft Prog',
            screenOrientation: 'LANDSCAPE',
            splitType: 'SPLIT_1',
            status: 0, // 草稿，不应同步
            layoutConfig: {
              regions: [{ regionId: 'r1', materials: [{ materialId: 101, duration: 10 }] }],
            },
            updatedAt: programUpdatedAt,
          },
        },
      ]);

      const result = await service.sync(device);

      expect(result.programs).toEqual([]);
      // 草稿节目的 materialId 不被收集 → 不查素材
      expect(prisma.material.findMany).not.toHaveBeenCalled();
      // 计划本身仍计入 version（plan updatedAt）
      expect(result.version).toBe(String(planUpdatedAt.getTime()));
    });

    it('deduplicates programs referenced by multiple plans', async () => {
      const sharedProgram = {
        id: 10,
        name: 'Prog A',
        screenOrientation: 'LANDSCAPE',
        splitType: 'SPLIT_1',
        status: 1,
        layoutConfig: {
          regions: [{ regionId: 'r1', materials: [{ materialId: 101, duration: 10 }] }],
        },
        updatedAt: programUpdatedAt,
      };
      (prisma.publishPlan.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          programId: 10,
          targetStoreIds: [storeId],
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: null,
          playDays: [1],
          status: 1,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: planUpdatedAt,
          program: sharedProgram,
        },
        {
          id: 2,
          programId: 10,
          targetStoreIds: [storeId],
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: null,
          playDays: [2],
          status: 1,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: planUpdatedAt,
          program: sharedProgram,
        },
      ]);
      (prisma.material.findMany as jest.Mock).mockResolvedValue([
        {
          id: 101,
          name: 'Mat A',
          type: 'IMAGE',
          fileUrl: '/uploads/materials/a.jpg',
          fileSize: BigInt(1048576),
          fileExtension: 'jpg',
          width: 1920,
          height: 1080,
          duration: null,
          thumbnailUrl: null,
          updatedAt: materialUpdatedAt,
        },
      ]);

      const result = await service.sync(device);

      expect(result.plans).toHaveLength(2);
      expect(result.programs).toHaveLength(1); // 去重
    });

    it('returns version 0 and empty arrays when store has no matching plans', async () => {
      (prisma.publishPlan.findMany as jest.Mock).mockResolvedValue([
        {
          id: 2,
          programId: 20,
          targetStoreIds: [999], // 不含本门店
          status: 1,
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: null,
          playDays: [6, 7],
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: planUpdatedAt,
          program: {
            id: 20,
            name: 'Prog Other',
            screenOrientation: 'LANDSCAPE',
            splitType: 'SPLIT_1',
            status: 1,
            layoutConfig: { regions: [] },
            updatedAt: programUpdatedAt,
          },
        },
      ]);

      const result = await service.sync(device);

      expect(result.version).toBe('0');
      expect(result.notModified).toBe(false);
      expect(result.plans).toEqual([]);
      expect(result.programs).toEqual([]);
      expect(result.materials).toEqual([]);
      // 无 materialId → 不查素材
      expect(prisma.material.findMany).not.toHaveBeenCalled();
    });
  });

  describe('heartbeat', () => {
    const device = { id: 1, code: 'D1', storeId: 7 } as DeviceIdentity;

    it('updates lastActiveAt and ipAddress only', async () => {
      (prisma.device.update as jest.Mock).mockResolvedValue({});

      const result = await service.heartbeat(device, { status: 'playing' }, '203.0.113.5');

      expect(result).toEqual({});
      expect(prisma.device.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          lastActiveAt: expect.any(Date),
          ipAddress: '203.0.113.5',
        },
      });
    });

    it('accepts metrics/currentProgramId/regionStates but does not persist them', async () => {
      (prisma.device.update as jest.Mock).mockResolvedValue({});

      await service.heartbeat(
        device,
        {
          status: 'playing',
          currentProgramId: 10,
          regionStates: [{ regionId: 'r1', materialId: 1 }],
          metrics: { cpu: 50, mem: 60, disk: 70, net: 'online' },
        },
        '203.0.113.5'
      );

      // 仅写 lastActiveAt + ipAddress，metrics 等不落库
      expect(prisma.device.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          lastActiveAt: expect.any(Date),
          ipAddress: '203.0.113.5',
        },
      });
    });
  });

  describe('logs', () => {
    const device = { id: 1, code: 'D1', storeId: 7 } as DeviceIdentity;

    it('writes entries and returns acceptedIds preferring clientLogId', async () => {
      (prisma.deviceLog.create as jest.Mock)
        .mockResolvedValueOnce({ id: BigInt(100) })
        .mockResolvedValueOnce({ id: BigInt(101) });

      const entries = [
        { type: 'play', payload: { materialId: 1 }, clientLogId: 'log-1' },
        { type: 'error', payload: { msg: 'crash' } },
      ];

      const result = await service.logs(device, entries as any);

      expect(result.acceptedIds).toEqual(['log-1', '101']);
      expect(prisma.deviceLog.create).toHaveBeenCalledTimes(2);
      expect(prisma.deviceLog.create).toHaveBeenNthCalledWith(1, {
        data: { deviceId: 1, type: 'play', payload: { materialId: 1 }, severity: 'INFO' },
      });
      expect(prisma.deviceLog.create).toHaveBeenNthCalledWith(2, {
        data: { deviceId: 1, type: 'error', payload: { msg: 'crash' }, severity: 'INFO' },
      });
    });

    it('applies severity when provided', async () => {
      (prisma.deviceLog.create as jest.Mock).mockResolvedValue({ id: BigInt(1) });

      await service.logs(device, [{ type: 'event', payload: {}, severity: 'WARN' }] as any);

      expect(prisma.deviceLog.create).toHaveBeenCalledWith({
        data: { deviceId: 1, type: 'event', payload: {}, severity: 'WARN' },
      });
    });

    it('returns self-increment id as string when clientLogId missing', async () => {
      (prisma.deviceLog.create as jest.Mock).mockResolvedValue({ id: BigInt(999) });

      const result = await service.logs(device, [{ type: 'play', payload: {} }] as any);

      expect(result.acceptedIds).toEqual(['999']);
    });

    it('preserves entries order in acceptedIds', async () => {
      (prisma.deviceLog.create as jest.Mock)
        .mockResolvedValueOnce({ id: BigInt(1) })
        .mockResolvedValueOnce({ id: BigInt(2) })
        .mockResolvedValueOnce({ id: BigInt(3) });

      const result = await service.logs(device, [
        { type: 'play', payload: {}, clientLogId: 'a' },
        { type: 'play', payload: {} },
        { type: 'play', payload: {}, clientLogId: 'c' },
      ] as any);

      expect(result.acceptedIds).toEqual(['a', '2', 'c']);
    });
  });

  describe('uploadScreenshot', () => {
    const device = { id: 5, code: 'D5', storeId: 7 } as DeviceIdentity;

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('throws FILE_NOT_UPLOADED when no file', async () => {
      await expect(service.uploadScreenshot(device, undefined as any)).rejects.toMatchObject({
        messageKey: 'FILE_NOT_UPLOADED',
      });
    });

    it('saves file to uploads/screenshots and returns url', async () => {
      const existsSync = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const writeFile = jest.spyOn(fs, 'writeFile').mockImplementation((_p, _b, cb) => cb(null));

      const file = { buffer: Buffer.from('fake-jpeg') } as Express.Multer.File;
      const result = await service.uploadScreenshot(device, file);

      expect(result.url).toMatch(/^\/uploads\/screenshots\/5_\d+\.jpg$/);
      expect(existsSync).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
      const savedPath = writeFile.mock.calls[0][0] as string;
      expect(savedPath).toContain('screenshots');
      expect(savedPath).toContain('5_');
    });

    it('creates screenshots dir when not exists', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const mkdirSync = jest.spyOn(fs, 'mkdirSync').mockReturnValue('' as any);
      jest.spyOn(fs, 'writeFile').mockImplementation((_p, _b, cb) => cb(null));

      const file = { buffer: Buffer.from('x') } as Express.Multer.File;
      await service.uploadScreenshot(device, file);

      expect(mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('ackCommand', () => {
    const device = { id: 1, code: 'D1', storeId: 7 } as DeviceIdentity;
    const commandId = 'cmd-uuid-1';

    it('sets status=2 on success and merges ack into payload', async () => {
      (prisma.deviceCommand.findFirst as jest.Mock).mockResolvedValue({
        id: commandId,
        deviceId: 1,
        payload: { target: 'screenshot' },
        status: 1,
      });
      (prisma.deviceCommand.update as jest.Mock).mockResolvedValue({});

      const result = await service.ackCommand(device, commandId, {
        result: 'success',
        screenshotUrl: '/uploads/screenshots/1_x.jpg',
      });

      expect(result).toEqual({});
      expect(prisma.deviceCommand.update).toHaveBeenCalledWith({
        where: { id: commandId },
        data: {
          status: 2,
          payload: {
            target: 'screenshot',
            ack: {
              result: 'success',
              error: undefined,
              screenshotUrl: '/uploads/screenshots/1_x.jpg',
            },
          },
        },
      });
    });

    it('sets status=3 on non-success result', async () => {
      (prisma.deviceCommand.findFirst as jest.Mock).mockResolvedValue({
        id: commandId,
        deviceId: 1,
        payload: {},
        status: 1,
      });
      (prisma.deviceCommand.update as jest.Mock).mockResolvedValue({});

      await service.ackCommand(device, commandId, {
        result: 'failed',
        error: 'timeout',
      });

      expect(prisma.deviceCommand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 3 }),
        })
      );
    });

    it('throws COMMAND_NOT_FOUND when command does not exist', async () => {
      (prisma.deviceCommand.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.ackCommand(device, commandId, { result: 'success' })
      ).rejects.toMatchObject({ messageKey: 'COMMAND_NOT_FOUND' });
      expect(prisma.deviceCommand.update).not.toHaveBeenCalled();
    });

    it('scopes findFirst to the requesting device', async () => {
      (prisma.deviceCommand.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.ackCommand(device, commandId, { result: 'success' })
      ).rejects.toMatchObject({ messageKey: 'COMMAND_NOT_FOUND' });

      expect(prisma.deviceCommand.findFirst).toHaveBeenCalledWith({
        where: { id: commandId, deviceId: 1 },
      });
    });
  });
});
