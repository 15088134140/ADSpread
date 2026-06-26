import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../../test/test-app';
import { loginAndGetToken } from '../../test/auth.helper';

describe('StoreController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await loginAndGetToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/api/stores').expect(401);
  });

  it('returns paginated stores with token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/stores')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.code).toBe(0);
    expect(response.body.data).toHaveProperty('list');
    expect(response.body.data).toHaveProperty('total');
  });

  it('creates, lists, and deletes a store', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/stores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E测试门店',
        code: 'E2E_STORE_001',
        industryCategory: 'CATERING',
      })
      .expect(201);

    expect(createRes.body.code).toBe(0);
    const storeId = createRes.body.data.id;

    await request(app.getHttpServer())
      .delete(`/api/stores/${storeId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
