import { Injectable } from '@nestjs/common';
import { Prisma, Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../../common/errors/business.exception';
import { getPagination, paginated } from '../../common/utils/pagination';
import { CreateStoreDto } from './dto/create-store.dto';
import { StoreQueryDto } from './dto/store-query.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: StoreQueryDto) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where: Prisma.StoreWhereInput = {};

    if (query.keyword) {
      where.OR = [{ name: { contains: query.keyword } }, { code: { contains: query.keyword } }];
    }
    if (query.industryCategory) where.industryCategory = query.industryCategory;
    if (typeof query.status === 'number') where.status = query.status;

    const [list, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { devices: true } } },
      }),
      this.prisma.store.count({ where }),
    ]);

    return paginated(
      list.map((item) => ({ ...item, deviceCount: item._count.devices })),
      total,
      page,
      pageSize
    );
  }

  async create(dto: CreateStoreDto) {
    await this.assertCodeUnique(dto.code);
    return this.prisma.store.create({ data: dto });
  }

  async update(id: number, dto: UpdateStoreDto) {
    await this.assertExists(id);
    if (dto.code) await this.assertCodeUnique(dto.code, id);
    return this.prisma.store.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.assertExists(id);
    const deviceCount = await this.prisma.device.count({ where: { storeId: id } });
    if (deviceCount > 0) throw new BusinessException('STORE_HAS_DEVICES');
    return this.prisma.store.delete({ where: { id } });
  }

  async options() {
    return this.prisma.store.findMany({
      where: { status: 1 },
      select: { id: true, name: true, code: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  industryCategories() {
    return [
      { value: 'CATERING', label: '餐饮', labelJa: '飲食', labelEn: 'Catering' },
      { value: 'RETAIL', label: '零售', labelJa: '小売', labelEn: 'Retail' },
      { value: 'BEAUTY', label: '美妆', labelJa: '美容', labelEn: 'Beauty' },
      { value: 'HOSPITALITY', label: '酒旅', labelJa: '宿泊・旅行', labelEn: 'Hospitality' },
      { value: 'EDUCATION', label: '教育', labelJa: '教育', labelEn: 'Education' },
      { value: 'AUTOMOTIVE', label: '汽车', labelJa: '自動車', labelEn: 'Automotive' },
      { value: 'LOCAL_LIFE', label: '本地生活', labelJa: 'ローカルライフ', labelEn: 'Local Life' },
      { value: 'OTHER', label: '其他', labelJa: 'その他', labelEn: 'Other' },
    ];
  }

  private async assertExists(id: number): Promise<Store> {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new BusinessException('STORE_NOT_FOUND');
    return store;
  }

  private async assertCodeUnique(code: string, excludeId?: number) {
    const existing = await this.prisma.store.findFirst({
      where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (existing) throw new BusinessException('STORE_CODE_EXISTS');
  }
}
