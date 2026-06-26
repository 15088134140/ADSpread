import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../../common/errors/business.exception';
import { getRegionBounds } from '../../common/utils/layout';

@Injectable()
export class DeviceApiService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentProgram(deviceCode: string) {
    // 查找设备
    const device = await this.prisma.device.findFirst({
      where: { code: deviceCode },
    });

    if (!device) {
      throw new BusinessException('设备不存在');
    }

    if (device.status !== 1) {
      return null;
    }

    // 获取设备所属门店
    const store = await this.prisma.store.findFirst({
      where: { id: device.storeId as any, status: 1 },
    });

    if (!store) {
      return null;
    }

    // 获取当前有效的发布计划
    const now = new Date();
    const currentDay = now.getDay() || 7; // 0是周日，改为7

    // 查询所有可能的计划，然后在内存中过滤
    const allPlans = await this.prisma.publishPlan.findMany({
      where: {
        status: 1,
        startTime: { lte: now },
        OR: [{ endTime: null }, { endTime: { gte: now } }],
      },
      include: { program: true },
      orderBy: { createdAt: 'desc' },
    });

    const plans = allPlans.filter((plan) => {
      // 检查目标门店
      const targetStoreIds = plan.targetStoreIds as any[];
      if (!targetStoreIds.includes(device.storeId)) {
        return false;
      }

      // 检查播放日期
      const playDays = plan.playDays as any[];
      if (!playDays.includes(currentDay)) {
        return false;
      }

      return true;
    });

    if (!plans.length) {
      return null;
    }

    // 获取当前时间的播放计划
    const currentPlan = plans[0];
    const program = currentPlan.program;

    if (!program || program.status !== 1) {
      return null;
    }

    // 查找实际播放的素材
    const programLayout = program.layoutConfig as any;
    const regions = programLayout?.regions || [];
    const materialIds = regions
      .flatMap((region) => region.materials || [])
      .map((m) => m.materialId);

    const materials = await this.prisma.material.findMany({
      where: {
        id: { in: materialIds },
        auditStatus: 'APPROVED',
      },
    });

    const materialMap = new Map(materials.map((m) => [m.id, m]));

    // 重构节目配置
    const programWithMaterials = {
      ...program,
      layoutConfig: {
        ...programLayout,
        regions: regions.map((region) => ({
          ...region,
          materials: (region.materials || [])
            .filter((m) => materialMap.has(m.materialId))
            .map((m) => ({
              ...m,
              material: materialMap.get(m.materialId),
            })),
        })),
      },
    };

    // 添加强制分屏信息
    const finalProgram = this.applyForcedSplit(programWithMaterials, device);

    return finalProgram;
  }

  private applyForcedSplit(program: any, device: any) {
    const { screenOrientation, splitType } = device;
    const programConfig = { ...program };

    // 调整程序配置以匹配设备的屏幕方向和分辨率
    if (programConfig.screenOrientation !== screenOrientation) {
      programConfig.screenOrientation = screenOrientation;
    }

    if (programConfig.splitType !== splitType) {
      programConfig.splitType = splitType;
    }

    // 确保每个区域都有边界
    programConfig.layoutConfig.regions = programConfig.layoutConfig.regions.map((region: any) => ({
      ...region,
      bounds: getRegionBounds(screenOrientation, splitType),
    }));

    return programConfig;
  }
}
