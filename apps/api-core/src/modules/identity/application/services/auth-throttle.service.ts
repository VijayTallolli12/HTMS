import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../../common/redis/redis.service';
import { SecurityConfig } from '@hms/config';

@Injectable()
export class AuthThrottleService {
  private readonly logger = new Logger(AuthThrottleService.name);
  private readonly securityConfig: SecurityConfig;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.get<SecurityConfig>('security');
    if (!config) {
      throw new Error('[AuthThrottleService] Security configuration missing from ConfigService.');
    }
    this.securityConfig = config;
  }

  private getIpKey(ip: string): string {
    const cleanIp = (ip || 'unknown').replace(/[^a-zA-Z0-9:._-]/g, '');
    return `${this.securityConfig.redisPrefixes.authThrottlingPrefix}ip:${cleanIp}`;
  }

  private getAccountKey(email: string): string {
    const cleanEmail = (email || '').trim().toLowerCase();
    return `${this.securityConfig.redisPrefixes.authThrottlingPrefix}account:${cleanEmail}`;
  }

  /**
   * Checks whether the current request is throttled by IP or account.
   * Throws 429 Too Many Requests if either threshold is breached.
   */
  async assertNotThrottled(ip: string, email: string): Promise<void> {
    const ipKey = this.getIpKey(ip);
    const accountKey = this.getAccountKey(email);

    const [rawIpCount, rawAccountCount] = await Promise.all([
      this.redisService.get(ipKey),
      this.redisService.get(accountKey),
    ]);

    const ipCount = parseInt(rawIpCount || '0', 10);
    const accountCount = parseInt(rawAccountCount || '0', 10);

    const maxIp = this.securityConfig.throttling.ipRateLimitMaxAttempts;
    const maxAccount = this.securityConfig.throttling.accountRateLimitMaxAttempts;

    if (ipCount >= maxIp || accountCount >= maxAccount) {
      this.logger.warn(
        `Throttling triggered: IP attempts=${ipCount}/${maxIp}, Account attempts=${accountCount}/${maxAccount}`,
      );
      throw new HttpException(
        'Too many authentication attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Records a failed authentication attempt across both IP and account dimensions.
   */
  async recordFailedAttempt(ip: string, email: string): Promise<void> {
    const ipKey = this.getIpKey(ip);
    const accountKey = this.getAccountKey(email);

    const ipWindow = this.securityConfig.throttling.ipRateLimitWindowSeconds;
    const accountWindow = this.securityConfig.throttling.accountRateLimitWindowSeconds;

    try {
      // Increment IP counter
      const ipCount = await this.redisService.incr(ipKey);
      if (ipCount === 1) {
        await this.redisService.expire(ipKey, ipWindow);
      }

      // Increment Account counter
      const accountCount = await this.redisService.incr(accountKey);
      if (accountCount === 1) {
        await this.redisService.expire(accountKey, accountWindow);
      }
    } catch (err: any) {
      this.logger.error(`Failed to record throttle counter in Redis: ${err.message}`);
    }
  }

  /**
   * Resets the account throttle on successful login.
   * Note: IP counter is intentionally preserved to defend against distributed password guessing.
   */
  async resetAccountThrottle(email: string): Promise<void> {
    try {
      const accountKey = this.getAccountKey(email);
      await this.redisService.del(accountKey);
    } catch (err: any) {
      this.logger.warn(`Failed to reset account throttle key in Redis: ${err.message}`);
    }
  }
}
