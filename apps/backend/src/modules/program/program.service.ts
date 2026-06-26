import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../../common/errors/business.exception';
import { getPagination, paginated } from '../../common/utils/pagination';
import { validateSplitType } from '../../common/utils/layout';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { ProgramQueryDto } from './dto/program-query.dto';

@Injectable()
export class ProgramService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ProgramQueryDto) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where: Prisma.ProgramWhereInput = {};

    if (query.keyword) {
      where.OR = [{ name: { contains: query.keyword } }];
    }
    if (query.screenOrientation) where.screenOrientation = query.screenOrientation as any;
    if (query.splitType) where.splitType = query.splitType as any;
    if (typeof query.status === 'number') where.status = query.status;

    const [list, total] = await Promise.all([
      this.prisma.program.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.program.count({ where }),
    ]);

    return paginated(list, total, page, pageSize);
  }

  async findOne(id: number) {
    const program = await this.prisma.program.findUnique({
      where: { id },
    });

    if (!program) {
      throw new BusinessException('节目不存在');
    }

    return program;
  }

  async create(dto: CreateProgramDto, adminId: number) {
    // 验证屏幕方向和分屏类型的兼容性
    validateSplitType(dto.screenOrientation as any, dto.splitType as any);

    // 验证所有引用的素材都已审核通过
    const materialIds = new Set<number>();
    dto.regions.forEach((region) => {
      region.materials.forEach((material) => {
        materialIds.add(material.materialId);
      });
    });

    const materials = await this.prisma.material.findMany({
      where: { id: { in: Array.from(materialIds) } },
    });

    // 检查是否有素材未找到或未审核通过
    const notFoundIds = Array.from(materialIds).filter(
      (id) => !materials.some((material) => material.id === id)
    );

    if (notFoundIds.length > 0) {
      throw new BusinessException(`素材不存在: ${notFoundIds.join(',')}`);
    }

    const unapprovedIds = materials
      .filter((material) => material.auditStatus !== 'APPROVED')
      .map((material) => material.id);
    if (unapprovedIds.length > 0) {
      throw new BusinessException(`素材未审核通过: ${unapprovedIds.join(',')}`);
    }

    // 保存节目
    const program = await this.prisma.program.create({
      data: {
        name: dto.name,
        screenOrientation: dto.screenOrientation as any,
        splitType: dto.splitType as any,
        status: dto.status ?? 0,
        createdBy: adminId,
        layoutConfig: {
          regions: dto.regions,
        } as any,
      },
    });

    return program;
  }

  async update(id: number, dto: UpdateProgramDto) {
    await this.findOne(id);

    if (dto.screenOrientation && dto.splitType) {
      validateSplitType(dto.screenOrientation as any, dto.splitType as any);
    }

    // 只透传 Prisma 认识的字段；regions 单独处理到 layoutConfig
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.screenOrientation !== undefined) updateData.screenOrientation = dto.screenOrientation;
    if (dto.splitType !== undefined) updateData.splitType = dto.splitType;
    if (dto.status !== undefined) updateData.status = dto.status;

    if (dto.regions) {
      const materialIds = new Set<number>();
      dto.regions.forEach((region) => {
        region.materials.forEach((material) => {
          materialIds.add(material.materialId);
        });
      });

      const materials = await this.prisma.material.findMany({
        where: { id: { in: Array.from(materialIds) } },
      });

      const notFoundIds = Array.from(materialIds).filter(
        (id) => !materials.some((material) => material.id === id)
      );

      if (notFoundIds.length > 0) {
        throw new BusinessException(`素材不存在: ${notFoundIds.join(',')}`);
      }

      const unapprovedIds = materials
        .filter((material) => material.auditStatus !== 'APPROVED')
        .map((material) => material.id);
      if (unapprovedIds.length > 0) {
        throw new BusinessException(`素材未审核通过: ${unapprovedIds.join(',')}`);
      }

      updateData.layoutConfig = {
        regions: dto.regions,
      } as any;
    }

    const program = await this.prisma.program.update({
      where: { id },
      data: updateData,
    });

    return program;
  }

  async publish(id: number, dto: Partial<CreateProgramDto>) {
    await this.findOne(id);

    // 允许已发布节目重新发布（更新内容后再次推送是常见需求）

    const updateData: any = {
      status: 1,
      publishedAt: new Date(),
    };

    if (dto.regions) {
      const materialIds = new Set<number>();
      dto.regions.forEach((region) => {
        region.materials.forEach((material) => {
          materialIds.add(material.materialId);
        });
      });

      const materials = await this.prisma.material.findMany({
        where: { id: { in: Array.from(materialIds) } },
      });

      const notFoundIds = Array.from(materialIds).filter(
        (id) => !materials.some((material) => material.id === id)
      );

      if (notFoundIds.length > 0) {
        throw new BusinessException(`素材不存在: ${notFoundIds.join(',')}`);
      }

      const unapprovedIds = materials
        .filter((material) => material.auditStatus !== 'APPROVED')
        .map((material) => material.id);
      if (unapprovedIds.length > 0) {
        throw new BusinessException(`素材未审核通过: ${unapprovedIds.join(',')}`);
      }

      updateData.layoutConfig = {
        regions: dto.regions,
      };
    }

    const updated = await this.prisma.program.update({
      where: { id },
      data: updateData,
    });

    return updated;
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.program.delete({ where: { id } });
  }
}
