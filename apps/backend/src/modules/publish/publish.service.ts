import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../../common/errors/business.exception';
import { getPagination, paginated } from '../../common/utils/pagination';
import { CreatePublishPlanDto } from './dto/create-publish-plan.dto';
import { UpdatePublishPlanDto } from './dto/update-publish-plan.dto';
import { PublishQueryDto } from './dto/publish-query.dto';
import { UpdatePublishStatusDto } from './dto/update-publish-status.dto';

@Injectable()
export class PublishService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PublishQueryDto) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where: Prisma.PublishPlanWhereInput = {};

    if (query.keyword) {
      where.OR = [{ name: { contains: query.keyword } }];
    }
    if (typeof query.programId === 'number') where.programId = query.programId;
    if (typeof query.status === 'number') where.status = query.status;

    const [list, total] = await Promise.all([
      this.prisma.publishPlan.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { program: true },
      }),
      this.prisma.publishPlan.count({ where }),
    ]);

    // 收集所有目标门店 ID，一次性查询门店名 + 启用设备数，避免 N+1
    const allStoreIds = Array.from(
      new Set(list.flatMap((plan) => (plan.targetStoreIds as number[]) || []))
    );

    let storeMap = new Map<number, { name: string; deviceCount: number }>();
    if (allStoreIds.length) {
      const stores = await this.prisma.store.findMany({
        where: { id: { in: allStoreIds } },
        select: { id: true, name: true },
      });
      // 仅统计启用设备（status=1），与推送时 targetDeviceCount 口径一致
      const deviceCounts = await this.prisma.device.groupBy({
        by: ['storeId'],
        where: { storeId: { in: allStoreIds }, status: 1 },
        _count: { _all: true },
      });
      const countMap = new Map(deviceCounts.map((d) => [d.storeId as number, d._count._all]));
      storeMap = new Map(
        stores.map((s) => [s.id, { name: s.name, deviceCount: countMap.get(s.id) ?? 0 }])
      );
    }

    const listWithStores = list.map((plan) => {
      const targetStoreIds = (plan.targetStoreIds as number[]) || [];
      const targetStores = targetStoreIds.map((id) => ({
        id,
        name: storeMap.get(id)?.name || `门店${id}`,
        deviceCount: storeMap.get(id)?.deviceCount ?? 0,
      }));
      // 保留 targetStoreIds 字段以兼容，新增 targetStores 详情
      return { ...plan, targetStores };
    });

    return paginated(listWithStores, total, page, pageSize);
  }

  async findOne(id: number) {
    const plan = await this.prisma.publishPlan.findUnique({
      where: { id },
      include: { program: true },
    });

    if (!plan) {
      throw new BusinessException('发布计划不存在');
    }

    return plan;
  }

  async create(dto: CreatePublishPlanDto, adminId: number) {
    // 验证节目是否存在且已发布
    const program = await this.prisma.program.findUnique({
      where: { id: dto.programId },
    });

    if (!program) {
      throw new BusinessException('节目不存在');
    }

    if (program.status !== 1) {
      throw new BusinessException('节目未发布');
    }

    // 验证目标门店是否存在
    const targetStoreCount = await this.prisma.store.count({
      where: { id: { in: dto.targetStoreIds }, status: 1 },
    });

    if (targetStoreCount < dto.targetStoreIds.length) {
      throw new BusinessException('部分目标门店不存在或已禁用');
    }

    // 创建发布计划
    const plan = await this.prisma.publishPlan.create({
      data: {
        name: dto.name,
        programId: dto.programId,
        targetStoreIds: dto.targetStoreIds,
        startTime: dto.startTime,
        endTime: dto.endTime,
        playDays: dto.playDays,
        status: dto.status ?? 1,
        createdBy: adminId,
      },
    });

    return plan;
  }

  async update(id: number, dto: UpdatePublishPlanDto) {
    const existing = await this.findOne(id);

    const updateData: any = {
      ...dto,
    };

    // 如果更新了节目，验证节目是否已发布
    if (dto.programId && dto.programId !== existing.programId) {
      const program = await this.prisma.program.findUnique({
        where: { id: dto.programId },
      });

      if (!program) {
        throw new BusinessException('节目不存在');
      }

      if (program.status !== 1) {
        throw new BusinessException('节目未发布');
      }
    }

    // 如果更新了目标门店，验证门店是否存在
    if (dto.targetStoreIds) {
      const targetStoreCount = await this.prisma.store.count({
        where: { id: { in: dto.targetStoreIds }, status: 1 },
      });

      if (targetStoreCount < dto.targetStoreIds.length) {
        throw new BusinessException('部分目标门店不存在或已禁用');
      }
    }

    const plan = await this.prisma.publishPlan.update({
      where: { id },
      data: updateData,
    });

    return plan;
  }

  async updateStatus(id: number, dto: UpdatePublishStatusDto) {
    await this.findOne(id);

    const plan = await this.prisma.publishPlan.update({
      where: { id },
      data: { status: dto.status },
    });

    return plan;
  }

  async push(id: number, adminId: number) {
    const plan = await this.findOne(id);

    if (plan.status !== 1) {
      throw new BusinessException('发布计划未启用');
    }

    // 获取目标设备数量
    const targetDeviceCount = await this.prisma.device.count({
      where: {
        storeId: { in: plan.targetStoreIds as any },
        status: 1,
      },
    });

    // 创建设备消息推送记录
    const pushLog = await this.prisma.pushMessageLog.create({
      data: {
        publishPlanId: id,
        targetDeviceCount,
        messageType: 'program_push',
        content: {
          programId: plan.programId,
          startTime: plan.startTime,
          endTime: plan.endTime,
          playDays: plan.playDays,
          regions: (plan.program as any).layoutConfig?.regions,
        },
        status: 1,
        createdBy: adminId,
      },
    });

    // 更新最后推送时间
    const updated = await this.prisma.publishPlan.update({
      where: { id },
      data: { lastPushedAt: new Date() },
    });

    return {
      ...updated,
      pushLogId: pushLog.id,
      targetDeviceCount,
    };
  }

  async batchPush(ids: number[], adminId: number) {
    const results: any[] = [];

    for (const id of ids) {
      try {
        const result = await this.push(id, adminId);
        results.push({ id, success: true, data: result });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }

    return results;
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.publishPlan.delete({ where: { id } });
  }
}
