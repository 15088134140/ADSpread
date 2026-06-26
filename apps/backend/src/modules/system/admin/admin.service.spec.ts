import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../../common/errors/business.exception';

describe('AdminService', () => {
  const prisma = {
    admin: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  let service: AdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminService(prisma);
  });

  describe('create', () => {
    it('rejects duplicate username', async () => {
      (prisma.admin.findFirst as jest.Mock).mockResolvedValue({ id: 9 });

      await expect(
        service.create({
          username: 'admin',
          password: 'Pass1234',
          name: '某管理员',
          roleId: 1,
        })
      ).rejects.toThrow('用户名已存在');
    });

    it('rejects when role does not exist', async () => {
      (prisma.admin.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.role.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create({
          username: 'newuser',
          password: 'Pass1234',
          name: '某管理员',
          roleId: 999,
        })
      ).rejects.toThrow('所选角色不存在');
    });

    it('hashes password with bcrypt rounds=12 and excludes passwordHash from result', async () => {
      (prisma.admin.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({ id: 2 });
      (bcrypt.hash as unknown as jest.Mock).mockResolvedValue('hashed-pwd');
      (prisma.admin.create as jest.Mock).mockImplementation(({ data, select }) => {
        // 模拟 prisma select 行为：返回 select 中包含的字段
        const { passwordHash, ...rest } = data;
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(select)) {
          result[key] = rest[key] ?? null;
        }
        return Promise.resolve(result);
      });

      const result = await service.create({
        username: 'newuser',
        password: 'Pass1234',
        name: '某管理员',
        roleId: 2,
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('Pass1234', 12);
      expect(prisma.admin.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            username: 'newuser',
            passwordHash: 'hashed-pwd',
            roleId: 2,
          }),
        })
      );
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.username).toBe('newuser');
    });
  });

  describe('update', () => {
    it('forbids disabling self', async () => {
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue({ id: 1 });

      await expect(service.update(1, { status: 0 }, 1)).rejects.toThrow('不可禁用当前登录账号');
    });

    it('allows disabling others', async () => {
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue({ id: 2 });
      (prisma.admin.update as jest.Mock).mockResolvedValue({ id: 2, status: 0 });

      const result = await service.update(2, { status: 0 }, 1);
      expect(result.status).toBe(0);
    });

    it('rejects nonexistent admin', async () => {
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.update(999, { name: 'x' }, 1)).rejects.toThrow('管理员不存在');
    });

    it('validates roleId existence when provided', async () => {
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue({ id: 2 });
      (prisma.role.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.update(2, { roleId: 999 }, 1)).rejects.toThrow('所选角色不存在');
    });
  });

  describe('remove', () => {
    it('forbids deleting self', async () => {
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue({ id: 1 });

      await expect(service.remove(1, 1)).rejects.toThrow('不可删除当前登录账号');
    });

    it('deletes other admin', async () => {
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue({ id: 2 });
      (prisma.admin.delete as jest.Mock).mockResolvedValue({ id: 2 });

      const result = await service.remove(2, 1);
      expect(result.id).toBe(2);
    });
  });

  describe('resetPassword', () => {
    it('hashes new password with rounds=12', async () => {
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue({ id: 5 });
      (bcrypt.hash as unknown as jest.Mock).mockResolvedValue('new-hash');
      (prisma.admin.update as jest.Mock).mockResolvedValue({});

      const result = await service.resetPassword(5, 'NewPass123');

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass123', 12);
      expect(prisma.admin.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { passwordHash: 'new-hash' },
      });
      expect(result).toEqual({ id: 5 });
    });

    it('rejects nonexistent admin', async () => {
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.resetPassword(999, 'NewPass123')).rejects.toThrow('管理员不存在');
    });
  });

  describe('findAll', () => {
    it('applies filters and paginates', async () => {
      (prisma.admin.findMany as jest.Mock).mockResolvedValue([{ id: 1 }]);
      (prisma.admin.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({
        username: 'admin',
        status: 1,
        roleId: 2,
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual({ list: [{ id: 1 }], total: 1, page: 1, pageSize: 10 });
      expect(prisma.admin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            username: { contains: 'admin' },
            status: 1,
            roleId: 2,
          }),
          skip: 0,
          take: 10,
        })
      );
    });
  });

  describe('BusinessException shape', () => {
    it('NOT_FOUND status for missing admin on remove', async () => {
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue(null);
      try {
        await service.remove(999, 1);
        fail('should throw');
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).getStatus()).toBe(404);
      }
    });
  });
});
