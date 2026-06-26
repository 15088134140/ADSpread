import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getPagination, paginated, PaginationInput } from '../../../common/utils/pagination';

export interface OperationLogCreateInput {
  adminId?: number | null;
  username?: string;
  operation: string;
  method?: string;
  params?: Record<string, unknown>;
  time: number;
  ip?: string;
  userAgent?: string;
  status: number;
  errorMsg?: string;
  roleId?: number | null;
  menuId?: number | null;
}

export interface OperationLogQueryDto extends PaginationInput {
  username?: string;
  operation?: string;
  startTime?: string;
  endTime?: string;
  status?: number;
}

@Injectable()
export class OperationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: OperationLogCreateInput) {
    return this.prisma.operationLog.create({
      data: {
        adminId: data.adminId ?? null,
        // schema 中 username 为非空 VarChar(50)，未携带登录用户时兜底
        username: data.username ?? 'unknown',
        operation: data.operation,
        method: data.method,
        params: data.params ? (data.params as unknown as Prisma.InputJsonValue) : undefined,
        time: data.time,
        ip: data.ip,
        userAgent: data.userAgent,
        status: data.status,
        errorMsg: data.errorMsg,
        roleId: data.roleId ?? null,
        menuId: data.menuId ?? null,
      },
    });
  }

  async findAll(query: OperationLogQueryDto) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where: Prisma.OperationLogWhereInput = {};

    if (query.username) {
      where.username = { contains: query.username };
    }
    if (query.operation) {
      where.operation = { contains: query.operation };
    }
    if (query.startTime || query.endTime) {
      where.createdAt = {};
      if (query.startTime) where.createdAt.gte = new Date(query.startTime);
      if (query.endTime) where.createdAt.lte = new Date(query.endTime);
    }
    if (typeof query.status === 'number') {
      where.status = query.status;
    }

    const [list, total] = await Promise.all([
      this.prisma.operationLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.operationLog.count({ where }),
    ]);

    return paginated(list, total, page, pageSize);
  }
}
