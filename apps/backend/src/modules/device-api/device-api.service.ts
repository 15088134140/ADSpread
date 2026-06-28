import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../../common/errors/business.exception';
import { getRegionBounds } from '../../common/utils/layout';
import { DeviceTokenService } from './auth/device-token.service';
import type { DeviceIdentity } from './decorators/current-device.decorator';
import type { BindRes, HardwareInfoDto } from './dto/bind.dto';
import type { MaterialDto, ProgramDto, PublishPlanDto } from './dto/sync.dto';
import type { HeartbeatReq } from './dto/heartbeat.dto';
import type { LogBatchRes, LogEntryDto } from './dto/log.dto';
import type { ScreenshotRes } from './dto/screenshot.dto';
import type { AckReq } from './dto/command-ack.dto';

/**
 * sync() 内部返回结构（service → controller）。
 *
 * notModified=true 表示客户端传入的 etag 命中当前 version，controller 据此回 304；
 * 此时 plans/programs/materials 为空（无需下发）。notModified=false 时三数组填充完整数据。
 */
export interface SyncResult {
  version: string;
  notModified: boolean;
  plans: PublishPlanDto[];
  programs: ProgramDto[];
  materials: MaterialDto[];
}

/** 含 program 关系的 PublishPlan 行类型（供 sync 内部强类型推导）。 */
type PlanWithProgram = Prisma.PublishPlanGetPayload<{ include: { program: true } }>;

@Injectable()
export class DeviceApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deviceTokenService: DeviceTokenService
  ) {}

  async getCurrentProgram(deviceCode: string) {
    // 查找设备
    const device = await this.prisma.device.findFirst({
      where: { code: deviceCode },
    });

    if (!device) {
      throw new BusinessException('DEVICE_NOT_FOUND');
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

  /**
   * 设备绑定（spec §1.2 / §9 / plan Task 2）。
   *
   * 凭设备编码完成绑定：校验 code 存在且启用 → 刷新硬件信息 → 签发 90d 设备 token。
   * V1 允许重复绑定（同 code 再调 bind 重新签发 token 并刷新 hardwareInfo），
   * 不强制"未绑定"前置状态——设备记录由后台预建，绑定本质是首次签发 token。
   */
  async bind(code: string, hardwareInfo: HardwareInfoDto, clientIp?: string): Promise<BindRes> {
    const device = await this.prisma.device.findFirst({ where: { code } });
    if (!device) {
      throw new BusinessException('DEVICE_NOT_FOUND');
    }
    if (device.status !== 1) {
      throw new BusinessException('DEVICE_DISABLED_OR_NOT_FOUND');
    }

    const updateData: Record<string, unknown> = {};
    if (hardwareInfo.mac !== undefined && hardwareInfo.mac !== null)
      updateData.macAddress = hardwareInfo.mac;
    if (hardwareInfo.appVersion !== undefined && hardwareInfo.appVersion !== null)
      updateData.appVersion = hardwareInfo.appVersion;
    if (hardwareInfo.resolution !== undefined && hardwareInfo.resolution !== null)
      updateData.screenResolution = hardwareInfo.resolution;
    if (clientIp !== undefined && clientIp !== null) updateData.ipAddress = clientIp;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.device.update({
        where: { id: device.id },
        data: updateData,
      });
    }

    const deviceToken = await this.deviceTokenService.issue({
      id: device.id,
      code: device.code,
    });

    return {
      deviceToken,
      storeId: device.storeId,
      deviceConfig: {
        screenOrientation: device.screenOrientation,
        splitType: device.splitType,
        screenResolution: hardwareInfo.resolution ?? device.screenResolution,
      },
    };
  }

  /**
   * 设备全量同步（spec §1.2 sync / §5.1 版本化 / plan §K4）。
   *
   * 返回该设备门店相关的全部生效发布计划、已发布节目（含 layoutConfig）与
   * APPROVED 素材元数据。version = 相关记录 updatedAt 最大值毫秒戳（简化方案），
   * 客户端带 ?etag=version 命中则 notModified=true（由 controller 回 304）。
   *
   * 未绑定门店（storeId=null）的设备不进调度，version='0' 且三数组为空。
   * 不做时间/星期过滤——由客户端 LocalScheduleEngine 本地复算（spec §5.2）。
   */
  async sync(device: DeviceIdentity, etag?: string): Promise<SyncResult> {
    const storeId = device.storeId;

    // 未绑定门店：不进调度，version 固定 '0'（spec §5.2 未绑定设备边界）
    if (storeId == null) {
      const version = '0';
      return { version, notModified: etag === version, plans: [], programs: [], materials: [] };
    }

    // 查所有 status=1 的发布计划（含 program），按 targetStoreIds 内存过滤
    // （targetStoreIds 为 Json，与 getCurrentProgram 一致采用内存过滤）
    const allPlans: PlanWithProgram[] = await this.prisma.publishPlan.findMany({
      where: { status: 1 },
      include: { program: true },
    });

    const storePlans = allPlans.filter((plan) => {
      const targetStoreIds = plan.targetStoreIds as unknown;
      return Array.isArray(targetStoreIds) && targetStoreIds.includes(storeId);
    });

    // 收集已发布节目（status=1），按 id 去重
    const programMap = new Map<number, NonNullable<PlanWithProgram['program']>>();
    for (const plan of storePlans) {
      const program = plan.program;
      if (program && program.status === 1 && !programMap.has(program.id)) {
        programMap.set(program.id, program);
      }
    }
    const programs = Array.from(programMap.values());

    // 从已发布节目的 layoutConfig 收集 materialId
    const materialIds = new Set<number>();
    for (const program of programs) {
      const layout = program.layoutConfig as {
        regions?: { materials?: { materialId?: unknown }[] }[];
      } | null;
      const regions = layout?.regions ?? [];
      for (const region of regions) {
        for (const item of region.materials ?? []) {
          if (typeof item.materialId === 'number') {
            materialIds.add(item.materialId);
          }
        }
      }
    }

    // 查 APPROVED 素材
    const materials = materialIds.size
      ? await this.prisma.material.findMany({
          where: { id: { in: Array.from(materialIds) }, auditStatus: 'APPROVED' },
        })
      : [];

    // version = 相关记录 updatedAt 最大值毫秒戳（plan §K4 简化方案）
    const timestamps: number[] = [];
    for (const plan of storePlans) timestamps.push(plan.updatedAt.getTime());
    for (const program of programs) timestamps.push(program.updatedAt.getTime());
    for (const material of materials) timestamps.push(material.updatedAt.getTime());
    const version = timestamps.length ? String(Math.max(...timestamps)) : '0';

    if (etag === version) {
      return { version, notModified: true, plans: [], programs: [], materials: [] };
    }

    const planDtos: PublishPlanDto[] = storePlans.map((p) => ({
      id: p.id,
      programId: p.programId,
      targetStoreIds: Array.isArray(p.targetStoreIds) ? (p.targetStoreIds as number[]) : [],
      startTime: p.startTime,
      endTime: p.endTime,
      playDays: Array.isArray(p.playDays) ? (p.playDays as number[]) : [],
      status: p.status,
      createdAt: p.createdAt,
    }));

    const programDtos: ProgramDto[] = programs.map((p) => ({
      id: p.id,
      name: p.name,
      screenOrientation: p.screenOrientation,
      splitType: p.splitType,
      layoutConfig: p.layoutConfig,
      status: p.status,
    }));

    const materialDtos: MaterialDto[] = materials.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      fileUrl: m.fileUrl,
      // BigInt → string（plan §K3 全局 patch 亦保证序列化不抛错，此处显式转换）
      fileSize: String(m.fileSize),
      fileExtension: m.fileExtension,
      width: m.width,
      height: m.height,
      duration: m.duration,
      thumbnailUrl: m.thumbnailUrl,
    }));

    return {
      version,
      notModified: false,
      plans: planDtos,
      programs: programDtos,
      materials: materialDtos,
    };
  }

  /**
   * 设备心跳（spec §1.2 heartbeat / plan Task 4）。
   *
   * V1 简化：仅更新 device.lastActiveAt=now() 与 ipAddress=clientIp。
   * metrics/currentProgramId/regionStates 仅做 DTO 校验不落库（plan Task 4 决策：
   * 不引入未被要求的历史表，超阈值告警列后续）。返回空对象，统一信封 data 为 {}。
   */
  async heartbeat(
    device: DeviceIdentity,
    _req: HeartbeatReq,
    clientIp?: string
  ): Promise<Record<string, never>> {
    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        lastActiveAt: new Date(),
        ipAddress: clientIp,
      },
    });
    return {};
  }

  /**
   * 设备日志批量上报（spec §1.2 logs / §13 / §5.5 网络恢复追平 / plan Task 4）。
   *
   * 逐条写入 DeviceLog，返回 acceptedIds（与 entries 顺序对应）：有 clientLogId 回传
   * clientLogId，无则回传自增 id（BigInt 转字符串）。逐条 create 而非 createMany，
   * 以取回自增 id 供无 clientLogId 的条目回传，供端侧按 id 删除本地缓冲。
   */
  async logs(device: DeviceIdentity, entries: LogEntryDto[]): Promise<LogBatchRes> {
    const acceptedIds: string[] = [];
    for (const entry of entries) {
      const created = await this.prisma.deviceLog.create({
        data: {
          deviceId: device.id,
          type: entry.type,
          payload: entry.payload as Prisma.InputJsonValue,
          severity: entry.severity ?? 'INFO',
        },
      });
      acceptedIds.push(entry.clientLogId ?? String(created.id));
    }
    return { acceptedIds };
  }

  /**
   * 设备截图上传（spec §1.2 screenshot / plan Task 4）。
   *
   * multipart 上传，存储到 uploads/screenshots/<deviceId>_<timestamp>.jpg，
   * 返回静态资源 URL。复用 material 模块的内存存储（multer memoryStorage）+
   * fs.writeFile 模式，确保目录存在。url 由 main.ts useStaticAssets 提供访问。
   */
  async uploadScreenshot(
    device: DeviceIdentity,
    file: Express.Multer.File
  ): Promise<ScreenshotRes> {
    if (!file) {
      throw new BusinessException('FILE_NOT_UPLOADED');
    }
    const dir = path.join(process.cwd(), 'uploads', 'screenshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filename = `${device.id}_${Date.now()}.jpg`;
    const filePath = path.join(dir, filename);
    await this.saveFile(file, filePath);
    return { url: `/uploads/screenshots/${filename}` };
  }

  /**
   * 设备远程指令回执（spec §1.2 commands ack / §6.2 device:ack / plan Task 4）。
   *
   * result='success' → status=2（已ack 成功），其他值 → status=3（失败）。
   * ack 结果（result/error/screenshotUrl）合并写入 payload.ack 供管理后台追溯。
   * 仅允许设备 ack 自身指令（deviceId 限定）；指令不存在抛 COMMAND_NOT_FOUND。
   */
  async ackCommand(
    device: DeviceIdentity,
    commandId: string,
    req: AckReq
  ): Promise<Record<string, never>> {
    const command = await this.prisma.deviceCommand.findFirst({
      where: { id: commandId, deviceId: device.id },
    });
    if (!command) {
      throw new BusinessException('COMMAND_NOT_FOUND');
    }
    const status = req.result === 'success' ? 2 : 3;
    const existingPayload = (command.payload as Prisma.InputJsonObject | null) ?? {};
    await this.prisma.deviceCommand.update({
      where: { id: commandId },
      data: {
        status,
        payload: {
          ...existingPayload,
          ack: {
            result: req.result,
            error: req.error,
            screenshotUrl: req.screenshotUrl,
          },
        } as Prisma.InputJsonValue,
      },
    });
    return {};
  }

  /**
   * 将 multer 内存存储的文件 buffer 写入磁盘（与 material.service 一致）。
   */
  private saveFile(file: Express.Multer.File, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, file.buffer, (err: NodeJS.ErrnoException | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
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

    // 确保每个区域都有边界（按 region 索引取对应 bounds，而非把整个数组塞给每个 region）
    const allBounds = getRegionBounds(screenOrientation, splitType);
    programConfig.layoutConfig.regions = programConfig.layoutConfig.regions.map(
      (region: any, i: number) => ({
        ...region,
        bounds: allBounds[i] ?? allBounds[0],
      })
    );

    return programConfig;
  }
}
