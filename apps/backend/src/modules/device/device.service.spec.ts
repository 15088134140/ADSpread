import { ScreenOrientation, SplitType } from '@prisma/client';
import * as xlsx from 'xlsx';
import { DeviceService } from './device.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 构造 xlsx buffer：第一行为表头，其余为数据行。
 */
function buildXlsx(rows: (string | number)[][]): Buffer {
  const sheet = xlsx.utils.aoa_to_sheet(rows);
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, sheet, 'Sheet1');
  return xlsx.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function fileFrom(buffer: Buffer): Express.Multer.File {
  return { buffer } as Express.Multer.File;
}

const HEADER = ['设备名称', '设备编码', '屏幕方向', '分辨率', '分屏类型', '所属门店ID', '备注'];

describe('DeviceService', () => {
  const deviceCreateMany = jest.fn();
  const prisma = {
    device: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: deviceCreateMany,
    },
    store: { findUnique: jest.fn() },
    $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) =>
      cb({ device: { createMany: deviceCreateMany } })
    ),
  } as unknown as PrismaService;

  let service: DeviceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeviceService(prisma);
  });

  it('creates a device without store', async () => {
    (prisma.device.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.device.create as jest.Mock).mockResolvedValue({ id: 1, storeId: null });

    const result = await service.create({
      name: '设备1',
      code: 'DEVICE001',
      screenOrientation: ScreenOrientation.LANDSCAPE,
      screenResolution: '1920x1080',
      splitType: SplitType.SPLIT_3_1,
    });

    expect(result.storeId).toBeNull();
  });

  it('rejects portrait 4 split', async () => {
    (prisma.device.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.create({
        name: '设备1',
        code: 'DEVICE001',
        screenOrientation: ScreenOrientation.PORTRAIT,
        screenResolution: '1080x1920',
        splitType: SplitType.SPLIT_4,
      })
    ).rejects.toThrow('屏幕方向与分屏类型不匹配');
  });

  describe('batchImport', () => {
    it('imports valid rows and reports successCount', async () => {
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(null);
      deviceCreateMany.mockResolvedValue({ count: 2 });

      const buffer = buildXlsx([
        HEADER,
        ['设备A', 'IMP_OK_A', 'LANDSCAPE', '1920x1080', 'SPLIT_1', '', ''],
        ['设备B', 'IMP_OK_B', 'PORTRAIT', '1080x1920', 'SPLIT_2', '', ''],
      ]);

      const result = await service.batchImport(fileFrom(buffer));

      expect(result.successCount).toBe(2);
      expect(result.failCount).toBe(0);
      expect(result.failures).toEqual([]);
      expect(deviceCreateMany).toHaveBeenCalledTimes(1);
      const arg = deviceCreateMany.mock.calls[0][0];
      expect(arg.data).toHaveLength(2);
      expect(arg.data[0]).toMatchObject({ name: '设备A', code: 'IMP_OK_A', storeId: null });
    });

    it('collects failures for missing required fields and split mismatch', async () => {
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(null);
      deviceCreateMany.mockResolvedValue({ count: 1 });

      const buffer = buildXlsx([
        HEADER,
        // 行1：缺设备编码
        ['缺编码设备', '', 'LANDSCAPE', '1920x1080', 'SPLIT_1', '', ''],
        // 行2：竖屏 + SPLIT_4（不匹配）
        ['错配设备', 'IMP_BAD_SPLIT', 'PORTRAIT', '1080x1920', 'SPLIT_4', '', ''],
        // 行3：合法
        ['合法设备', 'IMP_OK_C', 'LANDSCAPE', '1920x1080', 'SPLIT_1', '', ''],
      ]);

      const result = await service.batchImport(fileFrom(buffer));

      expect(result.successCount).toBe(1);
      expect(result.failCount).toBe(2);
      expect(result.failures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ row: 1, field: 'code' }),
          expect.objectContaining({
            row: 2,
            field: 'splitType',
            reason: expect.stringContaining('不匹配'),
          }),
        ])
      );
    });

    it('deduplicates intra-batch duplicate codes', async () => {
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(null);
      deviceCreateMany.mockResolvedValue({ count: 1 });

      const buffer = buildXlsx([
        HEADER,
        ['设备1', 'IMP_DUP_BATCH', 'LANDSCAPE', '1920x1080', 'SPLIT_1', '', ''],
        ['设备2', 'IMP_DUP_BATCH', 'LANDSCAPE', '1920x1080', 'SPLIT_1', '', ''],
      ]);

      const result = await service.batchImport(fileFrom(buffer));

      expect(result.successCount).toBe(1);
      expect(result.failCount).toBe(1);
      expect(result.failures[0]).toMatchObject({
        row: 2,
        field: 'code',
        reason: expect.stringContaining('当批重复'),
      });
      // 第二行不应再查 DB 唯一性（当批去重在 DB 校验之前短路）
      expect(prisma.device.findFirst as jest.Mock).toHaveBeenCalledTimes(1);
    });

    it('flags code already existing in DB', async () => {
      (prisma.device.findFirst as jest.Mock).mockResolvedValue({ id: 99, code: 'IMP_DB_DUP' });

      const buffer = buildXlsx([
        HEADER,
        ['已存在设备', 'IMP_DB_DUP', 'LANDSCAPE', '1920x1080', 'SPLIT_1', '', ''],
      ]);

      const result = await service.batchImport(fileFrom(buffer));

      expect(result.successCount).toBe(0);
      expect(result.failCount).toBe(1);
      expect(result.failures[0]).toMatchObject({
        row: 1,
        field: 'code',
        reason: expect.stringContaining('设备编码已存在'),
      });
      // 无合法行时不触发事务
      expect(prisma.$transaction as jest.Mock).not.toHaveBeenCalled();
    });

    it('flags non-existent storeId', async () => {
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(null);

      const buffer = buildXlsx([
        HEADER,
        ['门店不存在设备', 'IMP_NO_STORE', 'LANDSCAPE', '1920x1080', 'SPLIT_1', '999', ''],
      ]);

      const result = await service.batchImport(fileFrom(buffer));

      expect(result.successCount).toBe(0);
      expect(result.failCount).toBe(1);
      expect(result.failures[0]).toMatchObject({
        row: 1,
        field: 'storeId',
        reason: expect.stringContaining('门店不存在'),
      });
      // 门店校验在编码唯一校验之前，故不应再查 device 唯一性
      expect(prisma.device.findFirst as jest.Mock).not.toHaveBeenCalled();
    });

    it('falls back to per-row create when transaction fails', async () => {
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(null);
      // 事务整体抛错（如竞态唯一冲突）
      (prisma.$transaction as jest.Mock).mockRejectedValueOnce(new Error('tx failed'));
      // 回退逐条：第一条成功，第二条失败
      (prisma.device.create as jest.Mock)
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error('设备编码已存在'));

      const buffer = buildXlsx([
        HEADER,
        ['设备A', 'IMP_FB_A', 'LANDSCAPE', '1920x1080', 'SPLIT_1', '', ''],
        ['设备B', 'IMP_FB_B', 'LANDSCAPE', '1920x1080', 'SPLIT_1', '', ''],
      ]);

      const result = await service.batchImport(fileFrom(buffer));

      expect(result.successCount).toBe(1);
      expect(result.failCount).toBe(1);
      expect(result.failures[0]).toMatchObject({ row: 2, reason: '设备编码已存在' });
    });

    it('rejects invalid orientation enum value', async () => {
      const buffer = buildXlsx([
        HEADER,
        ['非法方向', 'IMP_BAD_ORI', 'HORIZONTAL', '1920x1080', 'SPLIT_1', '', ''],
      ]);

      const result = await service.batchImport(fileFrom(buffer));

      expect(result.successCount).toBe(0);
      expect(result.failCount).toBe(1);
      expect(result.failures[0]).toMatchObject({
        row: 1,
        field: 'screenOrientation',
        reason: expect.stringContaining('屏幕方向取值非法'),
      });
    });

    it('rejects file with no data rows', async () => {
      // 仅表头、无数据行 → sheet_to_json 返回空数组
      const buffer = buildXlsx([HEADER]);

      await expect(service.batchImport(fileFrom(buffer))).rejects.toThrow('Excel 文件无数据行');
    });
  });

  describe('getImportTemplate', () => {
    it('returns an xlsx buffer with standard headers and examples', () => {
      const buffer = service.getImportTemplate();

      expect(Buffer.isBuffer(buffer)).toBe(true);
      const wb = xlsx.read(buffer, { type: 'buffer' });
      expect(wb.SheetNames[0]).toBe('设备导入');
      const rows = xlsx.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], {
        header: 1,
      });
      // 表头行包含标准列
      expect(rows[0]).toEqual(
        expect.arrayContaining([
          '设备名称',
          '设备编码',
          '屏幕方向',
          '分辨率',
          '分屏类型',
          '所属门店ID',
          '备注',
        ])
      );
      // 至少一行示例
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });
  });
});
