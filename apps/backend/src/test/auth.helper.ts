import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';

export async function loginAndGetToken(app: INestApplication) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' })
    .expect(201);

  return response.body.data.token as string;
}
