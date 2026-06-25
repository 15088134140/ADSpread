import { Injectable } from '@nestjs/common';
import { Prisma, Device } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../../common/errors/business.exception';
import { getPagination, paginated } from '../../common/utils/pagination';
import { validateSplitType } from '../../common/utils/layout';
import { CreateDeviceDto } from './dto/create-device.dto';
import { DeviceQueryDto } from './dto/device-query.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: DeviceQueryDto) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where: Prisma.DeviceWhereInput = {};

    if (query.keyword) {
      where.OR = [{ name: { contains: query.keyword } }, { code: { contains: query.keyword } }];
    }
    if (typeof query.storeId === 'number') where.storeId = query.storeId;
    if (query.screenOrientation) where.screenOrientation = query.screenOrientation;
    if (query.splitType) where.splitType = query.splitType;
    if (typeof query.status === 'number') where.status = query.status;

    const [list, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { store: true },
      }),
      this.prisma.device.count({ where }),
    ]);

    return paginated(list, total, page, pageSize);
  }

  async create(dto: CreateDeviceDto) {
    await this.assertCodeUnique(dto.code);
    await this.assertStoreExists(dto.storeId);
    validateSplitType(dto.screenOrientation, dto.splitType);
    return this.prisma.device.create({ data: { ...dto, storeId: dto.storeId ?? null } });
  }

  async update(id: number, dto: UpdateDeviceDto) {
    await this.assertExists(id);
    if (dto.code) await this.assertCodeUnique(dto.code, id);
    await this.assertStoreExists(dto.storeId);
    if (dto.screenOrientation && dto.splitType)
      validateSplitType(dto.screenOrientation, dto.splitType);
    return this.prisma.device.update({
      where: { id },
      data: { ...dto, storeId: dto.storeId ?? undefined },
    });
  }

  async remove(id: number) {
    await this.assertExists(id);
    return this.prisma.device.delete({ where: { id } });
  }

  resolutions() {
    return ['1920x1080', '1080x1920', '3840x2160', '2160x3840'];
  }

  splitTypes() {
    return ['SPLIT_1', 'SPLIT_2', 'SPLIT_3', 'SPLIT_3_1', 'SPLIT_4'];
  }

  async options() {
    return this.prisma.device.findMany({
      where: { status: 1 },
      select: { id: true, name: true, code: true, storeId: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertExists(id: number): Promise<Device> {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new BusinessException('设备不存在');
    return device;
  }

  private async assertCodeUnique(code: string, excludeId?: number) {
    const existing = await this.prisma.device.findFirst({
      where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (existing) throw new BusinessException('设备编码已存在');
  }

  private async assertStoreExists(storeId?: number) {
    if (storeId) {
      const store = await this.prisma.store.findUnique({ where: { id: storeId } });
      if (!store) throw new BusinessException('所属门店不存在');
    }
  }
}
