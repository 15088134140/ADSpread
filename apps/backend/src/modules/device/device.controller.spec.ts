import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as xlsx from 'xlsx';
import { createTestApp } from '../../test/test-app';
import { loginAndGetToken } from '../../test/auth.helper';
import { PrismaService } from '../prisma/prisma.service';

describe('DeviceController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let restrictedToken: string;
  const createdCodes: string[] = [];
  let runTag: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    token = await loginAndGetToken(app);
    runTag = `IMP${Date.now()}`;

    // 创建无 device:import 权限的受限角色与账号，用于 403 验证（specs §5.6）。
    // menuIds 为空且角色名非「超级管理员」→ 权限集合为空 → 命中 device:import 返回 403。
    const restrictedRole = await prisma.role.upsert({
      where: { name: '导入受限角色' },
      update: { status: 1, menuIds: [] },
      create: { name: '导入受限角色', remark: '设备导入 403 测试', status: 1, menuIds: [] },
    });
    const hash = await bcrypt.hash('Restricted123', 12);
    await prisma.admin.upsert({
      where: { username: 'import_restricted' },
      update: { passwordHash: hash, roleId: restrictedRole.id, status: 1 },
      create: {
        username: 'import_restricted',
        passwordHash: hash,
        name: '导入受限',
        roleId: restrictedRole.id,
        status: 1,
      },
    });
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'import_restricted', password: 'Restricted123' })
      .expect(201);
    restrictedToken = loginRes.body.data.token;
  });

  afterAll(async () => {
    // 清理本测试导入/创建的设备
    if (createdCodes.length > 0) {
      await prisma.device.deleteMany({ where: { code: { in: createdCodes } } });
    }
    await app.close();
  });

  function buildXlsx(rows: (string | number)[][]): Buffer {
    const sheet = xlsx.utils.aoa_to_sheet(rows);
    const book = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(book, sheet, 'Sheet1');
    return xlsx.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  const HEADER = ['设备名称', '设备编码', '屏幕方向', '分辨率', '分屏类型', '所属门店ID', '备注'];

  it('returns paginated devices with token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/devices')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.code).toBe(0);
    expect(response.body.data).toHaveProperty('list');
  });

  it('creates a device without store and deletes it', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E测试设备',
        code: 'E2E_DEVICE_001',
        screenOrientation: 'LANDSCAPE',
        screenResolution: '1920x1080',
        splitType: 'SPLIT_1',
      })
      .expect(201);

    expect(createRes.body.code).toBe(0);
    const deviceId = createRes.body.data.id;

    await request(app.getHttpServer())
      .delete(`/api/devices/${deviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('rejects invalid device split', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E测试设备2',
        code: 'E2E_DEVICE_002',
        screenOrientation: 'PORTRAIT',
        screenResolution: '1080x1920',
        splitType: 'SPLIT_4',
      });

    expect(response.body.code).not.toBe(0);
  });

  it('imports valid rows and returns successCount', async () => {
    const code = `${runTag}_OK`;
    createdCodes.push(code);
    const buffer = buildXlsx([
      HEADER,
      ['导入测试设备', code, 'LANDSCAPE', '1920x1080', 'SPLIT_1', '', '导入'],
    ]);

    const res = await request(app.getHttpServer())
      .post('/api/devices/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, { filename: 'import-ok.xlsx' })
      .expect(201);

    expect(res.body.code).toBe(0);
    expect(res.body.data.successCount).toBe(1);
    expect(res.body.data.failCount).toBe(0);

    const found = await prisma.device.findUnique({ where: { code } });
    expect(found).not.toBeNull();
    expect(found?.splitType).toBe('SPLIT_1');
  });

  it('collects failures for invalid rows without aborting the batch', async () => {
    const dupCode = `${runTag}_DBDUP`;
    createdCodes.push(dupCode);
    // 先入库一个已存在设备，用于触发 DB 编码重复
    await request(app.getHttpServer())
      .post('/api/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '已存在设备',
        code: dupCode,
        screenOrientation: 'LANDSCAPE',
        screenResolution: '1920x1080',
        splitType: 'SPLIT_1',
      })
      .expect(201);

    const batchDup = `${runTag}_BATCHDUP`;
    const buffer = buildXlsx([
      HEADER,
      // 行1：缺设备编码
      ['缺编码', '', 'LANDSCAPE', '1920x1080', 'SPLIT_1', '', ''],
      // 行2：非法屏幕方向
      ['非法方向', `${runTag}_BADORI`, 'HORIZONTAL', '1920x1080', 'SPLIT_1', '', ''],
      // 行3：竖屏 + SPLIT_4 不匹配
      ['错配', `${runTag}_BADSPLIT`, 'PORTRAIT', '1080x1920', 'SPLIT_4', '', ''],
      // 行4：DB 已存在编码
      ['重复编码', dupCode, 'LANDSCAPE', '1920x1080', 'SPLIT_1', '', ''],
      // 行5/6：当批重复编码
      ['当批重复A', batchDup, 'LANDSCAPE', '1920x1080', 'SPLIT_1', '', ''],
      ['当批重复B', batchDup, 'LANDSCAPE', '1920x1080', 'SPLIT_1', '', ''],
    ]);

    const res = await request(app.getHttpServer())
      .post('/api/devices/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, { filename: 'import-fail.xlsx' })
      .expect(201);

    expect(res.body.code).toBe(0);
    // 行5 合法（当批首个），行6 当批重复 → 失败；其余 4 行失败
    expect(res.body.data.successCount).toBe(1);
    expect(res.body.data.failCount).toBe(5);
    expect(res.body.data.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: 1, field: 'code' }),
        expect.objectContaining({ row: 2, field: 'screenOrientation' }),
        expect.objectContaining({
          row: 4,
          field: 'code',
          reason: expect.stringContaining('已存在'),
        }),
        expect.objectContaining({
          row: 6,
          field: 'code',
          reason: expect.stringContaining('当批重复'),
        }),
      ])
    );
    createdCodes.push(batchDup);
  });

  it('rejects import without device:import permission (403)', async () => {
    const buffer = buildXlsx([
      HEADER,
      ['无权', `${runTag}_NOPE`, 'LANDSCAPE', '1920x1080', 'SPLIT_1', '', ''],
    ]);

    const res = await request(app.getHttpServer())
      .post('/api/devices/import')
      .set('Authorization', `Bearer ${restrictedToken}`)
      .attach('file', buffer, { filename: 'import-403.xlsx' })
      .expect(403);

    expect(res.body.code).not.toBe(0);
  });

  it('downloads the import template as xlsx with standard headers', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/devices/import-template')
      .set('Authorization', `Bearer ${token}`)
      .responseType('blob')
      .expect(200);

    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(Buffer.isBuffer(res.body)).toBe(true);

    const wb = xlsx.read(res.body, { type: 'buffer' });
    const rows = xlsx.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
    });
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
  });
});
