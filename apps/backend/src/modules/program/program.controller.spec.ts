import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../../test/test-app';
import { loginAndGetToken } from '../../test/auth.helper';

describe('ProgramController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await loginAndGetToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns paginated programs', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/programs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.code).toBe(0);
    expect(response.body.data).toHaveProperty('list');
  });

  it('creates a draft program and deletes it', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/programs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E测试节目',
        screenOrientation: 'ANY',
        splitType: 'ANY',
        regions: [],
        status: 0,
      })
      .expect(201);

    expect(createRes.body.code).toBe(0);
    const programId = createRes.body.data.id;

    await request(app.getHttpServer())
      .delete(`/api/programs/${programId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
