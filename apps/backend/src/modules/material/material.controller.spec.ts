import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../../test/test-app';
import { loginAndGetToken } from '../../test/auth.helper';

describe('MaterialController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await loginAndGetToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns paginated materials', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/materials')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.code).toBe(0);
    expect(response.body.data).toHaveProperty('list');
  });

  it('uploads, approves, and deletes a material', async () => {
    const uploadRes = await request(app.getHttpServer())
      .post('/api/materials/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake image data'), 'test.jpg')
      .expect(201);

    expect(uploadRes.body.code).toBe(0);
    const materialId = uploadRes.body.data.id;

    await request(app.getHttpServer())
      .put(`/api/materials/${materialId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/materials/${materialId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
