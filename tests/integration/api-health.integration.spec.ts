import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../apps/api-core/src/app.module';
import { GlobalHttpExceptionFilter } from '../../apps/api-core/src/common/filters/http-exception.filter';

describe('NestJS Health API Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new GlobalHttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health should return HTTP 200 and all infrastructure services up', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    if (res.status !== 200) {
      console.error('HEALTH CHECK ERROR BODY:', JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBe(200);

    expect(res.headers['x-correlation-id']).toBeDefined();
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.services).toBeDefined();

    expect(res.body.services.database.status).toBe('up');
    expect(res.body.services.database.latencyMs).toBeGreaterThanOrEqual(0);

    expect(res.body.services.rabbitmq.status).toBe('up');
    expect(res.body.services.rabbitmq.latencyMs).toBeGreaterThanOrEqual(0);

    expect(res.body.services.redis.status).toBe('up');
    expect(res.body.services.redis.latencyMs).toBeGreaterThanOrEqual(0);

    expect(res.body.services.mailpit.status).toBe('up');
    expect(res.body.services.mailpit.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/v1/health/liveness should return HTTP 200 with status ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/liveness').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/v1/health/readiness should return HTTP 200 with status ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/readiness').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.services.database.status).toBe('up');
    expect(res.body.services.rabbitmq.status).toBe('up');
    expect(res.body.services.redis.status).toBe('up');
  });
});
