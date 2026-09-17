import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('Redis Connectivity Integration Test', () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || 'hms_redis_dev_pass_2026',
      connectTimeout: 5000,
    });
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('should respond to PING with PONG', async () => {
    const response = await redis.ping();
    expect(response).toBe('PONG');
  });

  it('should set and retrieve a test key with expiry', async () => {
    const testKey = 'test:connectivity:key';
    const testVal = 'enterprise_hms_ok';

    await redis.set(testKey, testVal, 'EX', 10);
    const retrieved = await redis.get(testKey);
    expect(retrieved).toBe(testVal);

    await redis.del(testKey);
  });
});
