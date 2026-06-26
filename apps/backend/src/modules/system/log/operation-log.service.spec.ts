import { OperationLogService } from './operation-log.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('OperationLogService', () => {
  const prisma = {
    operationLog: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
  } as unknown as PrismaService;

  let service: OperationLogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OperationLogService(prisma);
  });

  describe('findAll', () => {
    it('applies username/operation/status filters and time range', async () => {
      (prisma.operationLog.findMany as jest.Mock).mockResolvedValue([
        { id: 1, operation: 'create' },
      ]);
      (prisma.operationLog.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({
        username: 'admin',
        operation: 'create',
        status: 1,
        startTime: '2026-06-01T00:00:00.000Z',
        endTime: '2026-06-30T23:59:59.000Z',
        page: 2,
        pageSize: 15,
      });

      expect(result).toEqual({
        list: [{ id: 1, operation: 'create' }],
        total: 1,
        page: 2,
        pageSize: 15,
      });

      const findManyCall = (prisma.operationLog.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where).toEqual({
        username: { contains: 'admin' },
        operation: { contains: 'create' },
        status: 1,
        createdAt: {
          gte: new Date('2026-06-01T00:00:00.000Z'),
          lte: new Date('2026-06-30T23:59:59.000Z'),
        },
      });
      expect(findManyCall.skip).toBe(15); // (2-1) * 15
      expect(findManyCall.take).toBe(15);
      expect(findManyCall.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('omits filters when not provided', async () => {
      (prisma.operationLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.operationLog.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ page: 1, pageSize: 20 });

      const findManyCall = (prisma.operationLog.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where).toEqual({});
    });

    it('supports partial time range (only startTime)', async () => {
      (prisma.operationLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.operationLog.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ startTime: '2026-06-01T00:00:00.000Z' });

      const findManyCall = (prisma.operationLog.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.createdAt).toEqual({
        gte: new Date('2026-06-01T00:00:00.000Z'),
      });
    });
  });

  describe('create', () => {
    it('persists operation log with all fields', async () => {
      (prisma.operationLog.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 1, ...data })
      );

      const result = await service.create({
        adminId: 1,
        username: 'admin',
        operation: 'create',
        method: 'POST',
        params: { foo: 'bar' },
        time: 42,
        ip: '127.0.0.1',
        userAgent: 'jest',
        status: 1,
        roleId: 2,
      });

      expect(prisma.operationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminId: 1,
          username: 'admin',
          operation: 'create',
          method: 'POST',
          params: { foo: 'bar' },
          time: 42,
          status: 1,
          roleId: 2,
        }),
      });
      expect(result.id).toBe(1);
    });

    it('defaults username to unknown when not provided', async () => {
      (prisma.operationLog.create as jest.Mock).mockResolvedValue({ id: 1 });

      await service.create({
        operation: 'login',
        time: 10,
        status: 1,
      });

      expect(prisma.operationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: 'unknown',
          adminId: null,
          roleId: null,
          menuId: null,
        }),
      });
    });
  });
});
