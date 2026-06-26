import { AuditStatus } from '@prisma/client';
import { MaterialService } from './material.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MaterialService', () => {
  const prisma = {
    material: { findUnique: jest.fn(), update: jest.fn() },
    program: { count: jest.fn() },
  } as unknown as PrismaService;

  let service: MaterialService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MaterialService(prisma);
  });

  beforeEach(() => {
    // 确保我们在每个测试前模拟 findUnique 返回素材
    (prisma.material.findUnique as jest.Mock).mockResolvedValue({ id: 1, auditStatus: 'PENDING' });
  });

  it('rejects short audit rejection reason', async () => {
    await expect(service.reject(1, 1, { reason: '太短' })).rejects.toThrow('驳回原因至少10个字符');
  });

  it('approves material and clears old reason', async () => {
    (prisma.material.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
    (prisma.material.update as jest.Mock).mockResolvedValue({
      id: 1,
      auditStatus: AuditStatus.APPROVED,
    });

    const result = await service.approve(1, 2);

    expect(prisma.material.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        auditStatus: AuditStatus.APPROVED,
        auditUserId: 2,
        auditTime: expect.any(Date),
        auditReason: null,
      },
    });
    expect(result.auditStatus).toBe(AuditStatus.APPROVED);
  });
});
