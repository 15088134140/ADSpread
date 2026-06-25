import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../../test/test-app';
import { loginAndGetToken } from '../../test/auth.helper';

describe('DeviceController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await loginAndGetToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

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
});
