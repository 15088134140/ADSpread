import { RoleService } from './role.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../../common/errors/business.exception';
import { SUPER_ADMIN_ROLE_NAME } from '../../../common/constants/rbac.constants';

describe('RoleService', () => {
  const prisma = {
    role: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    admin: {
      count: jest.fn(),
    },
  } as unknown as PrismaService;

  let service: RoleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RoleService(prisma);
  });

  describe('create', () => {
    it('rejects duplicate name', async () => {
      (prisma.role.findFirst as jest.Mock).mockResolvedValue({ id: 1 });

      await expect(service.create({ name: '运营人员' })).rejects.toThrow('角色名称已存在');
    });

    it('creates with empty menuIds when not provided', async () => {
      (prisma.role.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.role.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 5, ...data })
      );

      const result = await service.create({ name: '运营人员' });

      expect(prisma.role.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: '运营人员',
          menuIds: [],
        }),
      });
      expect(result.id).toBe(5);
    });
  });

  describe('remove', () => {
    it('forbids deleting super admin role', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: SUPER_ADMIN_ROLE_NAME,
      });

      await expect(service.remove(1)).rejects.toThrow('超级管理员角色不可删除');
      expect(prisma.admin.count).not.toHaveBeenCalled();
    });

    it('forbids deleting role with associated admins', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: 2,
        name: '运营人员',
      });
      (prisma.admin.count as jest.Mock).mockResolvedValue(3);

      await expect(service.remove(2)).rejects.toThrow('角色下存在关联管理员，无法删除');
      expect(prisma.role.delete).not.toHaveBeenCalled();
    });

    it('deletes role when no admins attached', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: 3,
        name: '访客',
      });
      (prisma.admin.count as jest.Mock).mockResolvedValue(0);
      (prisma.role.delete as jest.Mock).mockResolvedValue({ id: 3 });

      const result = await service.remove(3);
      expect(result.id).toBe(3);
    });

    it('rejects nonexistent role', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow('角色不存在');
    });
  });

  describe('assignMenus', () => {
    it('forbids modifying super admin role menuIds', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: SUPER_ADMIN_ROLE_NAME,
      });

      await expect(service.assignMenus(1, [1, 2, 3])).rejects.toThrow('超级管理员角色权限不可修改');
      expect(prisma.role.update).not.toHaveBeenCalled();
    });

    it('updates menuIds for normal role', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: 2,
        name: '运营人员',
      });
      (prisma.role.update as jest.Mock).mockImplementation(({ where, data }) =>
        Promise.resolve({ ...where, ...data })
      );

      const result = await service.assignMenus(2, [1, 2, 3]);
      expect(prisma.role.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { menuIds: [1, 2, 3] },
      });
      expect(result.menuIds).toEqual([1, 2, 3]);
    });
  });

  describe('update', () => {
    it('forbids renaming super admin role', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: SUPER_ADMIN_ROLE_NAME,
      });

      await expect(service.update(1, { name: '新名字' })).rejects.toThrow(
        '超级管理员角色名称不可修改'
      );
    });

    it('rejects duplicate name on update', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: 2,
        name: '运营人员',
      });
      (prisma.role.findFirst as jest.Mock).mockResolvedValue({ id: 3 });

      await expect(service.update(2, { name: '已存在名字' })).rejects.toThrow('角色名称已存在');
    });
  });

  describe('findAll', () => {
    it('includes adminCount in list', async () => {
      (prisma.role.findMany as jest.Mock).mockResolvedValue([
        { id: 2, name: '运营', _count: { admins: 3 } },
      ]);
      (prisma.role.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({ page: 1, pageSize: 10 });

      expect(result.list[0]).toHaveProperty('adminCount', 3);
      expect(result.list[0]).not.toHaveProperty('_count');
    });
  });

  describe('options', () => {
    it('returns only enabled roles with id and name', async () => {
      (prisma.role.findMany as jest.Mock).mockResolvedValue([{ id: 1, name: '超级管理员' }]);

      const result = await service.options();

      expect(prisma.role.findMany).toHaveBeenCalledWith({
        where: { status: 1 },
        select: { id: true, name: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([{ id: 1, name: '超级管理员' }]);
    });
  });

  describe('BusinessException shape', () => {
    it('NOT_FOUND status for missing role on assignMenus', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue(null);
      try {
        await service.assignMenus(999, [1]);
        fail('should throw');
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).getStatus()).toBe(404);
      }
    });
  });
});
