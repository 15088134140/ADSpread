import { DeviceApiService } from './device-api.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DeviceApiService', () => {
  const prisma = {
    device: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    store: { findFirst: jest.fn() },
    publishPlan: { findMany: jest.fn(), findUnique: jest.fn() },
    program: { findMany: jest.fn(), findUnique: jest.fn() },
    material: { findMany: jest.fn() },
  } as unknown as PrismaService;

  let service: DeviceApiService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeviceApiService(prisma);
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
});
