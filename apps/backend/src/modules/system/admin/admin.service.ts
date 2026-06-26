import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma, Admin } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../../common/errors/business.exception';
import { BusinessErrorCode } from '../../../common/errors/business-error-codes';
import { getPagination, paginated } from '../../../common/utils/pagination';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { QueryAdminDto } from './dto/query-admin.dto';

const BCRYPT_ROUNDS = 12;

/**
 * 管理员选字段：永远排除 passwordHash，避免泄漏。
 */
const ADMIN_PUBLIC_SELECT = {
  id: true,
  username: true,
  name: true,
  roleId: true,
  status: true,
  avatar: true,
  phone: true,
  email: true,
  lastLoginAt: true,
  lastLoginIp: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
} satisfies Prisma.AdminSelect;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryAdminDto) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where: Prisma.AdminWhereInput = {};

    if (query.username) where.username = { contains: query.username };
    if (query.name) where.name = { contains: query.name };
    if (typeof query.status === 'number') where.status = query.status;
    if (typeof query.roleId === 'number') where.roleId = query.roleId;

    const [list, total] = await Promise.all([
      this.prisma.admin.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: ADMIN_PUBLIC_SELECT,
      }),
      this.prisma.admin.count({ where }),
    ]);

    return paginated(list, total, page, pageSize);
  }

  async create(dto: CreateAdminDto) {
    await this.assertUsernameUnique(dto.username);
    await this.assertRoleExists(dto.roleId);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const { password, ...rest } = dto;

    return this.prisma.admin.create({
      data: { ...rest, passwordHash },
      select: ADMIN_PUBLIC_SELECT,
    });
  }

  async update(id: number, dto: UpdateAdminDto, currentUserId: number) {
    await this.assertExists(id);

    if (typeof dto.roleId === 'number') {
      await this.assertRoleExists(dto.roleId);
    }

    // 业务规则：不可将自身账号状态置为禁用，避免管理员误锁自己
    if (id === currentUserId && typeof dto.status === 'number' && dto.status === 0) {
      throw new BusinessException(
        'ADMIN_CANNOT_DISABLE_SELF',
        [],
        BusinessErrorCode.BUSINESS_RULE_VIOLATION
      );
    }

    return this.prisma.admin.update({
      where: { id },
      data: dto,
      select: ADMIN_PUBLIC_SELECT,
    });
  }

  async remove(id: number, currentUserId: number) {
    await this.assertExists(id);

    // 业务规则：不可删除自己
    if (id === currentUserId) {
      throw new BusinessException(
        'ADMIN_CANNOT_DELETE_SELF',
        [],
        BusinessErrorCode.BUSINESS_RULE_VIOLATION
      );
    }

    return this.prisma.admin.delete({
      where: { id },
      select: ADMIN_PUBLIC_SELECT,
    });
  }

  async resetPassword(id: number, newPassword: string) {
    await this.assertExists(id);
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.admin.update({
      where: { id },
      data: { passwordHash },
    });

    return { id };
  }

  private async assertExists(id: number): Promise<Admin> {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) {
      throw new BusinessException('ADMIN_NOT_FOUND', [], BusinessErrorCode.NOT_FOUND, 404);
    }
    return admin;
  }

  private async assertUsernameUnique(username: string, excludeId?: number) {
    const existing = await this.prisma.admin.findFirst({
      where: { username, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (existing) {
      throw new BusinessException(
        'ADMIN_USERNAME_EXISTS',
        [],
        BusinessErrorCode.DUPLICATE_RESOURCE
      );
    }
  }

  private async assertRoleExists(roleId: number) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new BusinessException('ROLE_SELECTED_NOT_FOUND', [], BusinessErrorCode.NOT_FOUND, 404);
    }
  }
}
