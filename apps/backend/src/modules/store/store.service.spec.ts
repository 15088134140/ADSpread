import { StoreService } from './store.service';
import { PrismaService } from '../prisma/prisma.service';
import { IndustryCategory } from '@prisma/client';

describe('StoreService', () => {
  const prisma = {
    store: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    device: {
      count: jest.fn(),
    },
  } as unknown as PrismaService;

  let service: StoreService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StoreService(prisma);
  });

  it('rejects duplicate store code on create', async () => {
    (prisma.store.findFirst as jest.Mock).mockResolvedValue({ id: 1 });

    await expect(
      service.create({ name: '涩谷店', code: 'SH001', industryCategory: IndustryCategory.CATERING })
    ).rejects.toThrow('门店编码已存在');
  });

  it('creates store when code is unique', async () => {
    (prisma.store.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.store.create as jest.Mock).mockResolvedValue({ id: 1, code: 'SH001' });

    const result = await service.create({
      name: '涩谷店',
      code: 'SH001',
      industryCategory: IndustryCategory.CATERING,
    });

    expect(result.id).toBe(1);
  });

  it('rejects deleting a store that has devices', async () => {
    (prisma.store.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
    (prisma.device.count as jest.Mock).mockResolvedValue(1);

    await expect(service.remove(1)).rejects.toThrow('门店下存在设备，无法删除');
  });
});
