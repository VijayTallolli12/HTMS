import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthThrottleService } from '../../apps/api-core/src/modules/identity/application/services/auth-throttle.service';
import { RedisService } from '../../apps/api-core/src/common/redis/redis.service';
import { parseSecurityConfig } from '@hms/config';

describe('AuthThrottleService (W1-T03 T04)', () => {
  let throttleService: AuthThrottleService;
  let redisMock: any;
  let configService: ConfigService;
  let inMemoryStore: Map<string, { value: string; ttl?: number }>;

  beforeEach(() => {
    inMemoryStore = new Map();

    redisMock = {
      get: jest.fn().mockImplementation((key: string) => {
        const item = inMemoryStore.get(key);
        return Promise.resolve(item ? item.value : null);
      }),
      set: jest.fn().mockImplementation((key: string, val: string) => {
        inMemoryStore.set(key, { value: val });
        return Promise.resolve('OK');
      }),
      incr: jest.fn().mockImplementation((key: string) => {
        const current = parseInt(inMemoryStore.get(key)?.value || '0', 10);
        const next = current + 1;
        inMemoryStore.set(key, { value: String(next) });
        return Promise.resolve(next);
      }),
      expire: jest.fn().mockImplementation((key: string, seconds: number) => {
        const item = inMemoryStore.get(key);
        if (item) item.ttl = seconds;
        return Promise.resolve(1);
      }),
      del: jest.fn().mockImplementation((key: string) => {
        const existed = inMemoryStore.delete(key);
        return Promise.resolve(existed ? 1 : 0);
      }),
    };

    const securityConfig = parseSecurityConfig({}, 'test');
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'security') return securityConfig;
        return undefined;
      }),
    } as unknown as ConfigService;

    throttleService = new AuthThrottleService(redisMock as unknown as RedisService, configService);
  });

  describe('Dual-Axis Rate Limiting in Redis', () => {
    const testIp = '192.168.1.50';
    const testEmail = 'user@enterprise-hms.com';

    it('40. should store and increment throttle state in Redis with appropriate TTL', async () => {
      await throttleService.recordFailedAttempt(testIp, testEmail);

      expect(redisMock.incr).toHaveBeenCalledWith(expect.stringContaining(`ip:${testIp}`));
      expect(redisMock.incr).toHaveBeenCalledWith(expect.stringContaining(`account:${testEmail}`));
      expect(redisMock.expire).toHaveBeenCalledWith(expect.stringContaining(`ip:${testIp}`), 900);
      expect(redisMock.expire).toHaveBeenCalledWith(
        expect.stringContaining(`account:${testEmail}`),
        900,
      );
    });

    it('38. Account/email throttling activates after max failed attempts (5)', async () => {
      // Record 4 failed attempts -> should NOT be throttled yet
      for (let i = 0; i < 4; i++) {
        await throttleService.recordFailedAttempt(testIp, testEmail);
      }
      await expect(throttleService.assertNotThrottled(testIp, testEmail)).resolves.toBeUndefined();

      // 5th attempt reaches account limit
      await throttleService.recordFailedAttempt(testIp, testEmail);

      // Now should throw 429 Too Many Requests
      await expect(throttleService.assertNotThrottled(testIp, testEmail)).rejects.toThrow(
        HttpException,
      );

      try {
        await throttleService.assertNotThrottled(testIp, testEmail);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.message).toContain('Too many authentication attempts');
      }
    });

    it('37. IP throttling activates after max failed attempts (20)', async () => {
      // Simulate multiple different accounts attacked from same IP
      for (let i = 0; i < 20; i++) {
        await throttleService.recordFailedAttempt(testIp, `victim${i}@enterprise-hms.com`);
      }

      await expect(
        throttleService.assertNotThrottled(testIp, 'new-victim@enterprise-hms.com'),
      ).rejects.toThrow(HttpException);
    });

    it('41. should reset account throttle on successful login without permanent lockout', async () => {
      for (let i = 0; i < 5; i++) {
        await throttleService.recordFailedAttempt(testIp, testEmail);
      }
      await expect(throttleService.assertNotThrottled(testIp, testEmail)).rejects.toThrow(
        HttpException,
      );

      // Reset account throttle (simulating valid login)
      await throttleService.resetAccountThrottle(testEmail);

      // Should now be unthrottled for this account from a new IP
      await expect(
        throttleService.assertNotThrottled('192.168.1.99', testEmail),
      ).resolves.toBeUndefined();
    });
  });
});
