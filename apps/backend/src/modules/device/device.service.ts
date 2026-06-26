import { Injectable } from '@nestjs/common';
import { Prisma, ScreenOrientation, SplitType, Device } from '@prisma/client';
import * as xlsx from 'xlsx';
import type { ImportResult } from '@adspread/types';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../../common/errors/business.exception';
import {
  resolveErrorMessage,
  type AppLocale,
  type ErrorMessageKey,
} from '../../common/i18n/error-messages';
import { getPagination, paginated } from '../../common/utils/pagination';
import { validateSplitType } from '../../common/utils/layout';
import { CreateDeviceDto } from './dto/create-device.dto';
import { DeviceQueryDto } from './dto/device-query.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

/**
 * Excel 导入表头字段（机读名）。
 */
type DeviceRowField =
  | 'name'
  | 'code'
  | 'screenOrientation'
  | 'screenResolution'
  | 'splitType'
  | 'storeId'
  | 'remark';

/**
 * 表头文本别名（中英文容错）。按字段列出可接受的表头文案，首项为模板使用的标准表头。
 */
const HEADER_ALIASES: Record<DeviceRowField, string[]> = {
  name: ['设备名称', 'name', '设备名'],
  code: ['设备编码', 'code', '编码'],
  screenOrientation: ['屏幕方向', 'screenOrientation', '方向'],
  screenResolution: ['分辨率', 'screenResolution', '分辨率(WxH)'],
  splitType: ['分屏类型', 'splitType', '分屏'],
  storeId: ['所属门店ID', '门店ID', '所属门店', 'storeId'],
  remark: ['备注', 'remark'],
};

const VALID_ORIENTATIONS = new Set<string>(Object.values(ScreenOrientation));
const VALID_SPLIT_TYPES = new Set<string>(Object.values(SplitType));

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

  /**
   * 批量导入设备（specs §5.6）。
   *
   * 解析 xlsx → 逐行校验（必填、枚举合法性、当批去重、validateSplitType、
   * assertStoreExists、assertCodeUnique）→ 合法行事务批量 createMany；
   * 非法行收集到 failures，不中断整体。事务失败时回退为逐条创建，尽量保留可插入行。
   */
  async batchImport(file: Express.Multer.File, locale: AppLocale = 'zh-CN'): Promise<ImportResult> {
    let workbook: xlsx.WorkBook;
    try {
      workbook = xlsx.read(file.buffer, { type: 'buffer' });
    } catch {
      throw new BusinessException('EXCEL_PARSE_FAILED');
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BusinessException('EXCEL_EMPTY');
    }
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
      defval: '',
    });
    if (rows.length === 0) {
      throw new BusinessException('EXCEL_EMPTY_ROWS');
    }

    const headerMap = this.buildHeaderMap(rows);
    const failures: ImportResult['failures'] = [];
    const seenCodes = new Set<string>();
    const validRows: Array<{ row: number; data: Prisma.DeviceCreateManyInput }> = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNo = i + 1;
      const outcome = await this.validateRow(rows[i], rowNo, headerMap, seenCodes, locale);
      if (outcome.ok) {
        validRows.push({ row: rowNo, data: outcome.data });
      } else {
        failures.push(outcome.failure);
      }
    }

    let successCount = 0;
    if (validRows.length > 0) {
      try {
        const created = await this.prisma.$transaction((tx) =>
          tx.device.createMany({ data: validRows.map((v) => v.data) })
        );
        successCount = created.count;
      } catch {
        // 事务失败（如编码竞态冲突）：回退为逐条创建，逐行收集失败，最大化导入成功率。
        for (const v of validRows) {
          try {
            await this.prisma.device.create({ data: v.data });
            successCount += 1;
          } catch (e) {
            failures.push({
              row: v.row,
              reason:
                e instanceof Error ? e.message : resolveErrorMessage('CREATE_FAILED', [], locale),
            });
          }
        }
      }
    }

    return {
      successCount,
      failCount: failures.length,
      failures,
    };
  }

  /**
   * 生成设备导入 xlsx 模板（specs §5.6）。
   * 第一个 sheet 为带表头与示例的数据表，第二个 sheet 为填写说明。
   */
  getImportTemplate(): Buffer {
    const header = ['设备名称', '设备编码', '屏幕方向', '分辨率', '分屏类型', '所属门店ID', '备注'];
    const examples: string[][] = [
      ['前台展示屏', 'DEVICE001', 'LANDSCAPE', '1920x1080', 'SPLIT_1', '1', '前台设备'],
      ['竖屏菜单', 'DEVICE002', 'PORTRAIT', '1080x1920', 'SPLIT_2', '', ''],
    ];
    const dataSheet = xlsx.utils.aoa_to_sheet([header, ...examples]);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, dataSheet, '设备导入');

    const guide: string[][] = [
      ['字段', '说明', '必填', '取值'],
      ['设备名称', '设备名称', '是', '文本，最长 100 字符'],
      ['设备编码', '设备唯一编码', '是', '文本，最长 50 字符，不可重复'],
      ['屏幕方向', '屏幕方向', '是', 'LANDSCAPE / PORTRAIT / ANY'],
      ['分辨率', '屏幕分辨率', '是', '如 1920x1080'],
      ['分屏类型', '分屏类型', '是', 'SPLIT_1 / SPLIT_2 / SPLIT_3 / SPLIT_3_1 / SPLIT_4 / ANY'],
      ['所属门店ID', '所属门店 ID', '否', '数字，需为已存在门店'],
      ['备注', '备注', '否', '文本'],
      [],
      ['说明', '横屏支持 SPLIT_1/2/3/3_1/4；竖屏支持 SPLIT_1/2/3；ANY 任意方向不校验。'],
    ];
    const guideSheet = xlsx.utils.aoa_to_sheet(guide);
    xlsx.utils.book_append_sheet(workbook, guideSheet, '填写说明');

    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  private async assertExists(id: number): Promise<Device> {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new BusinessException('DEVICE_NOT_FOUND');
    return device;
  }

  private async assertCodeUnique(code: string, excludeId?: number) {
    const existing = await this.prisma.device.findFirst({
      where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (existing) throw new BusinessException('DEVICE_CODE_EXISTS');
  }

  private async assertStoreExists(storeId?: number) {
    if (storeId) {
      const store = await this.prisma.store.findUnique({ where: { id: storeId } });
      if (!store) throw new BusinessException('STORE_NOT_EXISTS');
    }
  }

  /**
   * 逐行校验并构造待插入数据。复用 validateSplitType / assertStoreExists / assertCodeUnique，
   * 保持与单条 create 行为一致。当批重复用 seenCodes 在 DB 唯一校验之前短路。
   */
  private async validateRow(
    row: Record<string, unknown>,
    rowNo: number,
    headerMap: Partial<Record<DeviceRowField, string>>,
    seenCodes: Set<string>,
    locale: AppLocale
  ): Promise<
    | { ok: true; data: Prisma.DeviceCreateManyInput }
    | { ok: false; failure: { row: number; field?: string; reason: string } }
  > {
    const name = this.getString(row, headerMap.name);
    const code = this.getString(row, headerMap.code);
    const screenOrientation = this.getString(row, headerMap.screenOrientation);
    const screenResolution = this.getString(row, headerMap.screenResolution);
    const splitType = this.getString(row, headerMap.splitType);
    const storeId = this.getNumber(row, headerMap.storeId);
    const remark = this.getString(row, headerMap.remark);

    const fail = (field: string, key: ErrorMessageKey, params: unknown[] = []) => ({
      ok: false as const,
      failure: { row: rowNo, field, reason: resolveErrorMessage(key, params, locale) },
    });

    if (!name) return fail('name', 'DEVICE_ROW_NAME_REQUIRED');
    if (!code) return fail('code', 'DEVICE_ROW_CODE_REQUIRED');
    if (!screenOrientation)
      return fail('screenOrientation', 'DEVICE_ROW_SCREEN_ORIENTATION_REQUIRED');
    if (!screenResolution) return fail('screenResolution', 'DEVICE_ROW_SCREEN_RESOLUTION_REQUIRED');
    if (!splitType) return fail('splitType', 'DEVICE_ROW_SPLIT_TYPE_REQUIRED');

    if (!VALID_ORIENTATIONS.has(screenOrientation)) {
      return fail('screenOrientation', 'SCREEN_ORIENTATION_INVALID', [screenOrientation]);
    }
    if (!VALID_SPLIT_TYPES.has(splitType)) {
      return fail('splitType', 'SPLIT_TYPE_INVALID', [splitType]);
    }

    if (seenCodes.has(code)) {
      return fail('code', 'DEVICE_CODE_BATCH_DUPLICATE');
    }

    const orientation = screenOrientation as ScreenOrientation;
    const split = splitType as SplitType;

    try {
      validateSplitType(orientation, split);
    } catch (e) {
      return fail(
        'splitType',
        e instanceof BusinessException ? e.messageKey : 'SCREEN_SPLIT_MISMATCH',
        e instanceof BusinessException ? e.messageParams : []
      );
    }

    try {
      await this.assertStoreExists(storeId);
    } catch (e) {
      return fail(
        'storeId',
        e instanceof BusinessException ? e.messageKey : 'STORE_NOT_EXISTS',
        e instanceof BusinessException ? e.messageParams : []
      );
    }

    try {
      await this.assertCodeUnique(code);
    } catch (e) {
      return fail(
        'code',
        e instanceof BusinessException ? e.messageKey : 'DEVICE_CODE_EXISTS',
        e instanceof BusinessException ? e.messageParams : []
      );
    }

    seenCodes.add(code);
    return {
      ok: true as const,
      data: {
        name,
        code,
        screenOrientation: orientation,
        screenResolution,
        splitType: split,
        storeId: storeId ?? null,
        remark: remark ?? null,
      },
    };
  }

  /**
   * 根据表头文本容错映射字段→实际列键。按 trim+lowercase 归一化匹配别名。
   */
  private buildHeaderMap(rows: Record<string, unknown>[]): Partial<Record<DeviceRowField, string>> {
    const normalized = new Map<string, string>();
    rows.forEach((r) =>
      Object.keys(r).forEach((k) => {
        const key = k.trim().toLowerCase();
        if (!normalized.has(key)) normalized.set(key, k);
      })
    );
    const map: Partial<Record<DeviceRowField, string>> = {};
    (Object.keys(HEADER_ALIASES) as DeviceRowField[]).forEach((field) => {
      const alias = HEADER_ALIASES[field].find((a) => normalized.has(a.trim().toLowerCase()));
      if (alias) map[field] = normalized.get(alias.trim().toLowerCase());
    });
    return map;
  }

  private getString(row: Record<string, unknown>, key: string | undefined): string | undefined {
    if (!key) return undefined;
    const v = row[key];
    if (v === undefined || v === null || v === '') return undefined;
    return String(v).trim();
  }

  private getNumber(row: Record<string, unknown>, key: string | undefined): number | undefined {
    const s = this.getString(row, key);
    if (s === undefined) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }
}
