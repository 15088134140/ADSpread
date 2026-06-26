import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../../common/errors/business.exception';
import { BusinessErrorCode } from '../../../common/errors/business-error-codes';
import { SUPER_ADMIN_ROLE_NAME } from '../../../common/constants/rbac.constants';
import { getPagination, paginated } from '../../../common/utils/pagination';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { QueryRoleDto } from './dto/query-role.dto';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryRoleDto) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where: Prisma.RoleWhereInput = {};

    if (query.name) where.name = { contains: query.name };
    if (typeof query.status === 'number') where.status = query.status;

    const [list, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { admins: true } } },
      }),
      this.prisma.role.count({ where }),
    ]);

    return paginated(
      list.map(({ _count, ...item }) => ({
        ...item,
        adminCount: _count.admins,
      })),
      total,
      page,
      pageSize
    );
  }

  async options() {
    return this.prisma.role.findMany({
      where: { status: 1 },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateRoleDto) {
    await this.assertNameUnique(dto.name);
    return this.prisma.role.create({
      data: {
        name: dto.name,
        remark: dto.remark,
        status: dto.status,
        menuIds: dto.menuIds ?? [],
      },
    });
  }

  async update(id: number, dto: UpdateRoleDto) {
    const role = await this.assertExists(id);
    // 超管角色名称不可改（防止误改后失去超管识别）
    if (role.name === SUPER_ADMIN_ROLE_NAME && dto.name && dto.name !== role.name) {
      throw new BusinessException(
        '超级管理员角色名称不可修改',
        BusinessErrorCode.BUSINESS_RULE_VIOLATION
      );
    }
    if (dto.name && dto.name !== role.name) {
      await this.assertNameUnique(dto.name, id);
    }
    return this.prisma.role.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    const role = await this.assertExists(id);

    // 业务规则：超级管理员角色不可删除
    if (role.name === SUPER_ADMIN_ROLE_NAME) {
      throw new BusinessException(
        '超级管理员角色不可删除',
        BusinessErrorCode.BUSINESS_RULE_VIOLATION
      );
    }

    // 业务规则：有关联管理员时不可删除
    const adminCount = await this.prisma.admin.count({ where: { roleId: id } });
    if (adminCount > 0) {
      throw new BusinessException(
        '角色下存在关联管理员，无法删除',
        BusinessErrorCode.BUSINESS_RULE_VIOLATION
      );
    }

    return this.prisma.role.delete({ where: { id } });
  }

  async assignMenus(id: number, menuIds: number[]) {
    const role = await this.assertExists(id);

    // 业务规则：超管角色 menuIds 不可改（运行时识别为全部启用菜单）
    if (role.name === SUPER_ADMIN_ROLE_NAME) {
      throw new BusinessException(
        '超级管理员角色权限不可修改',
        BusinessErrorCode.BUSINESS_RULE_VIOLATION
      );
    }

    return this.prisma.role.update({
      where: { id },
      data: { menuIds },
    });
  }

  private async assertExists(id: number): Promise<Role> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new BusinessException('角色不存在', BusinessErrorCode.NOT_FOUND, 404);
    }
    return role;
  }

  private async assertNameUnique(name: string, excludeId?: number) {
    const existing = await this.prisma.role.findFirst({
      where: { name, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (existing) {
      throw new BusinessException('角色名称已存在', BusinessErrorCode.DUPLICATE_RESOURCE);
    }
  }
}
