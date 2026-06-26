import { Injectable } from '@nestjs/common';
import { Menu, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../../common/errors/business.exception';
import { BusinessErrorCode } from '../../../common/errors/business-error-codes';
import { getPagination, paginated } from '../../../common/utils/pagination';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { QueryMenuDto } from './dto/query-menu.dto';

/**
 * 菜单树节点：在 Menu 基础上挂 children。
 * 与 packages/types MenuTreeNode 形态一致（前端可直接消费）。
 */
export type MenuTreeNode = Menu & { children: MenuTreeNode[] };

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryMenuDto) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where: Prisma.MenuWhereInput = {};

    if (query.name) where.name = { contains: query.name };
    if (typeof query.status === 'number') where.status = query.status;
    if (typeof query.type === 'number') where.type = query.type;

    const [list, total] = await Promise.all([
      this.prisma.menu.findMany({
        where,
        skip,
        take,
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.menu.count({ where }),
    ]);

    return paginated(list, total, page, pageSize);
  }

  /**
   * 返回按 parentId 自关联、按 sort 排序的菜单树。
   * 默认仅返回 status=1 的菜单；可通过 onlyEnabled=false 关闭。
   */
  async findTree(onlyEnabled = true): Promise<MenuTreeNode[]> {
    const menus = await this.prisma.menu.findMany({
      where: onlyEnabled ? { status: 1 } : undefined,
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    return this.buildTree(menus);
  }

  async options() {
    return this.prisma.menu.findMany({
      where: { status: 1 },
      select: { id: true, name: true },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
  }

  async create(dto: CreateMenuDto) {
    if (dto.parentId !== undefined) {
      await this.assertParentExists(dto.parentId);
    }
    return this.prisma.menu.create({ data: dto });
  }

  async update(id: number, dto: UpdateMenuDto) {
    await this.assertExists(id);
    if (dto.parentId !== undefined && dto.parentId !== null) {
      await this.assertParentExists(dto.parentId);
      // 业务规则：不可将自身设为父级（形成自环）
      if (dto.parentId === id) {
        throw new BusinessException(
          '不可将菜单的父级设为自身',
          BusinessErrorCode.BUSINESS_RULE_VIOLATION
        );
      }
    }
    return this.prisma.menu.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.assertExists(id);

    // 业务规则：有子菜单不可删除
    const childCount = await this.prisma.menu.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new BusinessException(
        '存在子菜单，无法删除',
        BusinessErrorCode.BUSINESS_RULE_VIOLATION
      );
    }

    return this.prisma.menu.delete({ where: { id } });
  }

  /**
   * 由扁平菜单列表构建树。
   * 算法：先按 id 索引，再遍历挂到父节点的 children；根节点（parentId 为空或父节点不在列表内）作为顶层。
   */
  private buildTree(menus: Menu[]): MenuTreeNode[] {
    const map = new Map<number, MenuTreeNode>();
    for (const menu of menus) {
      map.set(menu.id, { ...menu, children: [] });
    }

    const roots: MenuTreeNode[] = [];
    for (const node of map.values()) {
      const parentId = node.parentId;
      if (parentId !== null && parentId !== undefined && map.has(parentId)) {
        map.get(parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // 递归排序：buildTree 输入已按 sort 排序，挂载时保持顺序即可。
    return roots;
  }

  private async assertExists(id: number): Promise<Menu> {
    const menu = await this.prisma.menu.findUnique({ where: { id } });
    if (!menu) {
      throw new BusinessException('菜单不存在', BusinessErrorCode.NOT_FOUND, 404);
    }
    return menu;
  }

  private async assertParentExists(parentId: number) {
    const parent = await this.prisma.menu.findUnique({ where: { id: parentId } });
    if (!parent) {
      throw new BusinessException('父菜单不存在', BusinessErrorCode.NOT_FOUND, 404);
    }
  }
}
