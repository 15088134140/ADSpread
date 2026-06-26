import { MenuService } from './menu.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../../common/errors/business.exception';

describe('MenuService', () => {
  const prisma = {
    menu: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as unknown as PrismaService;

  let service: MenuService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MenuService(prisma);
  });

  describe('remove', () => {
    it('forbids deleting menu with children', async () => {
      (prisma.menu.findUnique as jest.Mock).mockResolvedValue({ id: 25 });
      (prisma.menu.count as jest.Mock).mockResolvedValue(3);

      await expect(service.remove(25)).rejects.toThrow('存在子菜单，无法删除');
      expect(prisma.menu.delete).not.toHaveBeenCalled();
    });

    it('deletes leaf menu', async () => {
      (prisma.menu.findUnique as jest.Mock).mockResolvedValue({ id: 3 });
      (prisma.menu.count as jest.Mock).mockResolvedValue(0);
      (prisma.menu.delete as jest.Mock).mockResolvedValue({ id: 3 });

      const result = await service.remove(3);
      expect(result.id).toBe(3);
    });

    it('rejects nonexistent menu', async () => {
      (prisma.menu.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow('菜单不存在');
    });
  });

  describe('create', () => {
    it('validates parent existence when parentId provided', async () => {
      (prisma.menu.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.create({ name: '子菜单', parentId: 999 })).rejects.toThrow(
        '父菜单不存在'
      );
    });

    it('creates without parent check when parentId omitted', async () => {
      (prisma.menu.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 100, ...data })
      );

      const result = await service.create({ name: '顶级菜单' });
      expect(prisma.menu.findUnique).not.toHaveBeenCalled();
      expect(result.id).toBe(100);
    });
  });

  describe('update', () => {
    it('forbids setting parentId to self', async () => {
      (prisma.menu.findUnique as jest.Mock).mockResolvedValue({ id: 5 });

      await expect(service.update(5, { parentId: 5 })).rejects.toThrow('不可将菜单的父级设为自身');
    });

    it('validates parent existence on update', async () => {
      (prisma.menu.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 5 }) // assertExists
        .mockResolvedValueOnce(null); // assertParentExists
      await expect(service.update(5, { parentId: 999 })).rejects.toThrow('父菜单不存在');
    });
  });

  describe('findTree', () => {
    it('builds nested tree from flat list, sorted by sort then id', async () => {
      // 故意打乱输入顺序，但 service 内部 orderBy 已由 prisma 保证；
      // 这里直接给已排序数据验证 buildTree 挂载逻辑。
      const flat = [
        { id: 1, name: '系统管理', parentId: null, sort: 7 },
        { id: 26, name: '管理员', parentId: 1, sort: 1 },
        { id: 27, name: '新增管理员', parentId: 26, sort: 1 },
        { id: 30, name: '角色', parentId: 1, sort: 2 },
      ];
      (prisma.menu.findMany as jest.Mock).mockResolvedValue(flat);

      const tree = await service.findTree(true);

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(1);
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].id).toBe(26);
      expect(tree[0].children[0].children).toHaveLength(1);
      expect(tree[0].children[0].children[0].id).toBe(27);
      expect(tree[0].children[1].id).toBe(30);
    });

    it('treats orphan (parent not in list) as root', async () => {
      const flat = [
        { id: 10, name: '孤儿', parentId: 999, sort: 1 },
        { id: 1, name: '根', parentId: null, sort: 1 },
      ];
      (prisma.menu.findMany as jest.Mock).mockResolvedValue(flat);

      const tree = await service.findTree(true);
      expect(tree).toHaveLength(2);
    });

    it('passes onlyEnabled filter to prisma when true', async () => {
      (prisma.menu.findMany as jest.Mock).mockResolvedValue([]);

      await service.findTree(true);

      expect(prisma.menu.findMany).toHaveBeenCalledWith({
        where: { status: 1 },
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      });
    });

    it('passes no status filter when onlyEnabled=false', async () => {
      (prisma.menu.findMany as jest.Mock).mockResolvedValue([]);

      await service.findTree(false);

      expect(prisma.menu.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      });
    });
  });

  describe('options', () => {
    it('returns enabled menus with id and name, sorted', async () => {
      (prisma.menu.findMany as jest.Mock).mockResolvedValue([{ id: 1, name: '仪表盘' }]);

      const result = await service.options();

      expect(prisma.menu.findMany).toHaveBeenCalledWith({
        where: { status: 1 },
        select: { id: true, name: true },
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      });
      expect(result).toEqual([{ id: 1, name: '仪表盘' }]);
    });
  });

  describe('findAll', () => {
    it('applies name/status/type filters', async () => {
      (prisma.menu.findMany as jest.Mock).mockResolvedValue([{ id: 1 }]);
      (prisma.menu.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({
        name: '管理',
        status: 1,
        type: 2,
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual({ list: [{ id: 1 }], total: 1, page: 1, pageSize: 10 });
      expect(prisma.menu.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: { contains: '管理' },
            status: 1,
            type: 2,
          },
          orderBy: [{ sort: 'asc' }, { id: 'asc' }],
        })
      );
    });
  });

  describe('BusinessException shape', () => {
    it('NOT_FOUND status for missing menu on remove', async () => {
      (prisma.menu.findUnique as jest.Mock).mockResolvedValue(null);
      try {
        await service.remove(999);
        fail('should throw');
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).getStatus()).toBe(404);
      }
    });
  });
});
