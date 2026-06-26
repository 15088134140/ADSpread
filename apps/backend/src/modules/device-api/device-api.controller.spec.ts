import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../../test/test-app';

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
});
