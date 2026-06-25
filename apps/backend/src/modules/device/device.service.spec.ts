import { ScreenOrientation, SplitType } from '@prisma/client';
import { DeviceService } from './device.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DeviceService', () => {
  const prisma = {
    device: { findFirst: jest.fn(), create: jest.fn() },
    store: { findUnique: jest.fn() },
  } as unknown as PrismaService;

  let service: DeviceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeviceService(prisma);
  });

  it('creates a device without store', async () => {
    (prisma.device.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.device.create as jest.Mock).mockResolvedValue({ id: 1, storeId: null });

    const result = await service.create({
      name: '设备1',
      code: 'DEVICE001',
      screenOrientation: ScreenOrientation.LANDSCAPE,
      screenResolution: '1920x1080',
      splitType: SplitType.SPLIT_3_1,
    });

    expect(result.storeId).toBeNull();
  });

  it('rejects portrait 4 split', async () => {
    (prisma.device.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.create({
        name: '设备1',
        code: 'DEVICE001',
        screenOrientation: ScreenOrientation.PORTRAIT,
        screenResolution: '1080x1920',
        splitType: SplitType.SPLIT_4,
      })
    ).rejects.toThrow('屏幕方向与分屏类型不匹配');
  });
});
