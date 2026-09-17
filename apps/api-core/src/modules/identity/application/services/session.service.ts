import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../../../common/database/prisma.service';
import { RedisService } from '../../../../common/redis/redis.service';
import { SecurityConfig } from '@hms/config';
import { generateUuidV7 } from '@hms/shared';
import { AuthSession } from '@prisma/client';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly securityConfig: SecurityConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.get<SecurityConfig>('security');
    if (!config) {
      throw new Error('[SessionService] Security configuration missing from ConfigService.');
    }
    this.securityConfig = config;
  }

  /**
   * Creates an AuthSession backing the user's login.
   * Default lifetime uses staff refresh expiration (8 hours / 28800s).
   */
  async createSession(params: {
    userId: string;
    deviceInfo?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthSession> {
    const sessionId = generateUuidV7();
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const lifetimeSeconds = this.securityConfig.refreshToken.staffExpiresInSeconds;
    const expiresAt = new Date(Date.now() + lifetimeSeconds * 1000);

    return this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: params.userId,
        sessionToken,
        deviceInfo: params.deviceInfo,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        expiresAt,
      },
    });
  }

  /**
   * Revokes an active AuthSession and associated refresh tokens.
   * Populates Redis fast-revocation key and updates PostgreSQL record.
   */
  async revokeSession(sessionId: string, reason = 'LOGOUT'): Promise<void> {
    const now = new Date();
    const ttlSeconds = this.securityConfig.refreshToken.staffExpiresInSeconds;

    // 1. Fast Redis revocation blacklist
    try {
      await this.redisService.set(
        `${this.securityConfig.redisPrefixes.sessionRevocationPrefix}${sessionId}`,
        'revoked',
        'EX',
        ttlSeconds,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to set Redis revocation key for session ${sessionId}: ${err.message}`,
      );
    }

    // 2. Database update
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.authSession.updateMany({
          where: { id: sessionId, revokedAt: null },
          data: {
            revokedAt: now,
            revocationReason: reason,
          },
        });

        await tx.refreshToken.updateMany({
          where: { sessionId, revokedAt: null },
          data: {
            revokedAt: now,
          },
        });
      });
    } catch (err: any) {
      this.logger.error(`Failed to record session revocation in database: ${err.message}`);
    }
  }

  /**
   * Checks whether a session is revoked via Redis (fast lookup).
   */
  async isSessionRevoked(sessionId: string): Promise<boolean> {
    const exists = await this.redisService.exists(
      `${this.securityConfig.redisPrefixes.sessionRevocationPrefix}${sessionId}`,
    );
    return exists === 1;
  }

  /**
   * Finds an active AuthSession by ID.
   */
  async findActiveSession(sessionId: string): Promise<AuthSession | null> {
    if (await this.isSessionRevoked(sessionId)) {
      return null;
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.revokedAt !== null || session.expiresAt < new Date()) {
      return null;
    }

    return session;
  }
}
