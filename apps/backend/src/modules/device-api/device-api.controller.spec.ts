import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createTestApp } from '../../test/test-app';
import { TransformInterceptor } from '../../interceptors/transform.interceptor';
import { DeviceApiModule } from './device-api.module';
import { DeviceApiService, type SyncResult } from './device-api.service';
import { DeviceGuard } from './guards/device.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('DeviceApiController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns error for non-existent device', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/device/program')
      .query({ deviceCode: 'NON_EXISTENT_DEVICE' });

    expect(response.body.code).not.toBe(0);
  });

  it('returns error for bind with non-existent code', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/device/bind')
      .send({ code: 'NON_EXISTENT_BIND_CODE', hardwareInfo: {} });

    expect(response.body.code).not.toBe(0);
  });

  /**
   * sync 路由的 304/200 行为（plan Task 3 关键风险点：304 与 TransformInterceptor 兼容）。
   *
   * 用 mock DeviceGuard（直接放行并注入 device 身份）+ mock DeviceApiService.sync，
   * 并显式注册全局 TransformInterceptor 复现生产环境，断言：
   *  - 304 命中时无 body + ETag header（即使 TransformInterceptor 在场）
   *  - 200 时手动封装统一信封 + ETag header
   */
  describe('GET /api/device/sync (ETag/304)', () => {
    let syncApp: INestApplication;
    const syncMock = jest.fn();
    const deviceIdentity = { id: 1, code: 'DEVICE001', storeId: 7 };

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [DeviceApiModule] })
        .overrideGuard(DeviceGuard)
        .useValue({
          canActivate(context: any) {
            const req = context.switchToHttp().getRequest();
            req.device = deviceIdentity;
            return true;
          },
        })
        .overrideProvider(DeviceApiService)
        .useValue({ sync: syncMock })
        // 覆盖 PrismaService 避免 onModuleInit 触发 $connect（本测试不触库，DB 无需可用）
        .overrideProvider(PrismaService)
        .useValue({})
        .compile();

      syncApp = moduleRef.createNestApplication();
      syncApp.setGlobalPrefix('api');
      // 显式注册 TransformInterceptor 复现生产全局拦截器，验证 304 仍无 body
      syncApp.useGlobalInterceptors(new TransformInterceptor());
      await syncApp.init();
    });

    afterAll(async () => {
      await syncApp.close();
    });

    beforeEach(() => {
      syncMock.mockReset();
    });

    it('returns 304 with no body and ETag header when etag matches', async () => {
      const version = '1719360000000';
      const result: SyncResult = {
        version,
        notModified: true,
        plans: [],
        programs: [],
        materials: [],
      };
      syncMock.mockResolvedValue(result);

      const res = await request(syncApp.getHttpServer())
        .get('/api/device/sync')
        .set('Authorization', 'Bearer mock-device-token')
        .query({ etag: version });

      expect(res.status).toBe(304);
      // 304 必须无 body（TransformInterceptor 在场也不能写入）
      expect(res.text).toBeFalsy();
      expect(Object.keys(res.body).length).toBe(0);
      expect(res.headers['etag']).toBe(version);
      expect(syncMock).toHaveBeenCalledWith(deviceIdentity, version);
    });

    it('returns 200 with unified envelope + ETag header on full sync', async () => {
      const version = '1719360000000';
      const result: SyncResult = {
        version,
        notModified: false,
        plans: [
          {
            id: 1,
            programId: 10,
            targetStoreIds: [7],
            startTime: new Date('2026-01-01T00:00:00.000Z'),
            endTime: null,
            playDays: [1, 2, 3, 4, 5],
            status: 1,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
        programs: [
          {
            id: 10,
            name: 'Prog A',
            screenOrientation: 'LANDSCAPE',
            splitType: 'SPLIT_1',
            layoutConfig: {
              regions: [{ regionId: 'r1', materials: [{ materialId: 101, duration: 10 }] }],
            },
            status: 1,
          },
        ],
        materials: [
          {
            id: 101,
            name: 'Mat A',
            type: 'IMAGE',
            fileUrl: '/uploads/materials/a.jpg',
            fileSize: '1048576',
            fileExtension: 'jpg',
            width: 1920,
            height: 1080,
            duration: null,
            thumbnailUrl: null,
          },
        ],
      };
      syncMock.mockResolvedValue(result);

      const res = await request(syncApp.getHttpServer())
        .get('/api/device/sync')
        .set('Authorization', 'Bearer mock-device-token')
        .query({ etag: '0' });

      expect(res.status).toBe(200);
      expect(res.headers['etag']).toBe(version);
      // 手动封装的统一信封（非 TransformInterceptor 的包装——data 内含 version 字段）
      // 注意：res.json() 经 JSON.stringify 将 Date 序列化为 ISO 字符串
      expect(res.body).toEqual({
        code: 0,
        message: 'success',
        data: {
          version,
          plans: [
            {
              id: 1,
              programId: 10,
              targetStoreIds: [7],
              startTime: '2026-01-01T00:00:00.000Z',
              endTime: null,
              playDays: [1, 2, 3, 4, 5],
              status: 1,
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          programs: result.programs,
          materials: result.materials,
        },
        timestamp: expect.any(Number),
      });
      // fileSize 经 BigInt 序列化为字符串
      expect(typeof res.body.data.materials[0].fileSize).toBe('string');
      expect(res.body.data.materials[0].fileSize).toBe('1048576');
    });

    it('returns 200 when no etag query is provided', async () => {
      const version = '1719360000000';
      syncMock.mockResolvedValue({
        version,
        notModified: false,
        plans: [],
        programs: [],
        materials: [],
      } satisfies SyncResult);

      const res = await request(syncApp.getHttpServer())
        .get('/api/device/sync')
        .set('Authorization', 'Bearer mock-device-token');

      expect(res.status).toBe(200);
      expect(res.headers['etag']).toBe(version);
      expect(res.body.code).toBe(0);
      expect(res.body.data.version).toBe(version);
      // 未传 etag → syncMock 第二参数为 undefined
      expect(syncMock).toHaveBeenCalledWith(deviceIdentity, undefined);
    });
  });

  /**
   * 上行接口鉴权失败（plan Task 4）：无设备令牌时各上行路由均应 401。
   *
   * 用真实 DeviceGuard（不 overrideGuard）+ 覆盖 PrismaService 为空对象，
   * 无 token 时 guard.extractToken 在查库前即抛 DEVICE_TOKEN_INVALID（401），
   * 故 DB 无需可用。该测试同时验证了路由已绑定（不存在会 404 而非 401）。
   */
  describe('上行接口鉴权失败（无 token → 401）', () => {
    let authApp: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [DeviceApiModule] })
        // 覆盖 PrismaService 避免 onModuleInit 触发 $connect（无 token 时 guard 不查库）
        .overrideProvider(PrismaService)
        .useValue({})
        .compile();

      authApp = moduleRef.createNestApplication();
      authApp.setGlobalPrefix('api');
      await authApp.init();
    });

    afterAll(async () => {
      await authApp.close();
    });

    it('heartbeat 无 token 返回 401', async () => {
      const res = await request(authApp.getHttpServer())
        .post('/api/device/heartbeat')
        .send({ status: 'playing' });
      expect(res.status).toBe(401);
      expect(res.body.code).not.toBe(0);
    });

    it('logs 无 token 返回 401', async () => {
      const res = await request(authApp.getHttpServer())
        .post('/api/device/logs')
        .send({ entries: [{ type: 'play', payload: {} }] });
      expect(res.status).toBe(401);
      expect(res.body.code).not.toBe(0);
    });

    it('screenshot 无 token 返回 401', async () => {
      const res = await request(authApp.getHttpServer()).post('/api/device/screenshot');
      expect(res.status).toBe(401);
      expect(res.body.code).not.toBe(0);
    });

    it('commands/:id/ack 无 token 返回 401', async () => {
      const res = await request(authApp.getHttpServer())
        .post('/api/device/commands/cmd-1/ack')
        .send({ result: 'success' });
      expect(res.status).toBe(401);
      expect(res.body.code).not.toBe(0);
    });
  });
});
