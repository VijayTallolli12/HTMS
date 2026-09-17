import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../../../common/database/prisma.service';
import { RedisService } from '../../../../common/redis/redis.service';
import { SecurityConfig } from '@hms/config';
import { generateUuidV7 } from '@hms/shared';

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);
  private readonly securityConfig: SecurityConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.get<SecurityConfig>('security');
    if (!config) {
      throw new Error('[RefreshTokenService] Security configuration missing from ConfigService.');
    }
    this.securityConfig = config;
  }

  /**
   * Hashes a plaintext token using SHA-256 before database lookup/storage.
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Generates and persists the initial refresh token for an AuthSession.
   * Plaintext token is returned once for client transport and NEVER stored.
   */
  async createInitialRefreshToken(sessionId: string): Promise<{
    plaintextToken: string;
    tokenFamily: string;
    expiresAt: Date;
  }> {
    const plaintextToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(plaintextToken);
    const tokenFamily = generateUuidV7();
    const tokenId = generateUuidV7();
    const lifetimeSeconds = this.securityConfig.refreshToken.staffExpiresInSeconds;
    const expiresAt = new Date(Date.now() + lifetimeSeconds * 1000);

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        sessionId,
        tokenFamily,
        tokenHash,
        expiresAt,
      },
    });

    return {
      plaintextToken,
      tokenFamily,
      expiresAt,
    };
  }

  /**
   * Atomically verifies and rotates a refresh token with concurrency protection
   * and reuse detection via PostgreSQL row-level locking (SELECT ... FOR UPDATE).
   */
  async rotateRefreshToken(candidatePlaintext: string): Promise<{
    newPlaintextToken: string;
    sessionId: string;
    userId: string;
  }> {
    if (!candidatePlaintext || typeof candidatePlaintext !== 'string') {
      throw new UnauthorizedException('Refresh token must be provided.');
    }

    const candidateHash = this.hashToken(candidatePlaintext);
    const now = new Date();
    const lifetimeSeconds = this.securityConfig.refreshToken.staffExpiresInSeconds;
    const newExpiresAt = new Date(now.getTime() + lifetimeSeconds * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Lock the candidate token row in PostgreSQL
      const lockedTokens = await tx.$queryRaw<
        Array<{
          id: string;
          sessionId: string;
          tokenFamily: string;
          tokenHash: string;
          issuedAt: Date;
          expiresAt: Date;
          usedAt: Date | null;
          revokedAt: Date | null;
          replacedByTokenId: string | null;
        }>
      >`
        SELECT
          id,
          session_id AS "sessionId",
          token_family AS "tokenFamily",
          token_hash AS "tokenHash",
          issued_at AS "issuedAt",
          expires_at AS "expiresAt",
          used_at AS "usedAt",
          revoked_at AS "revokedAt",
          replaced_by_token_id AS "replacedByTokenId"
        FROM platform_schema.refresh_tokens
        WHERE token_hash = ${candidateHash}
        LIMIT 1
        FOR UPDATE
      `;

      const tokenRecord = lockedTokens[0];
      if (!tokenRecord) {
        throw new UnauthorizedException('Invalid or unknown refresh token.');
      }

      // 2. Token Reuse Detection
      if (tokenRecord.usedAt !== null || tokenRecord.revokedAt !== null) {
        // Revoke the entire token family
        await tx.refreshToken.updateMany({
          where: { tokenFamily: tokenRecord.tokenFamily },
          data: { revokedAt: now },
        });

        // Revoke the backing session in database
        await tx.authSession.updateMany({
          where: { id: tokenRecord.sessionId },
          data: {
            revokedAt: now,
            revocationReason: 'REFRESH_TOKEN_REUSE_DETECTED',
          },
        });

        return {
          reused: true as const,
          id: tokenRecord.id,
          tokenFamily: tokenRecord.tokenFamily,
          sessionId: tokenRecord.sessionId,
        };
      }

      // 3. Expiration Check
      if (tokenRecord.expiresAt < now) {
        throw new UnauthorizedException('Refresh token has expired.');
      }

      // 4. Session Validation
      const session = await tx.authSession.findUnique({
        where: { id: tokenRecord.sessionId },
      });

      if (!session || session.revokedAt !== null || session.expiresAt < now) {
        throw new UnauthorizedException('Associated session has been revoked or expired.');
      }

      // 5. Generate and persist new token in the same tokenFamily
      const newPlaintext = crypto.randomBytes(48).toString('base64url');
      const newHash = this.hashToken(newPlaintext);
      const newTokenId = generateUuidV7();

      // Persist replacement token first to satisfy foreign key constraint on replacedByTokenId
      await tx.refreshToken.create({
        data: {
          id: newTokenId,
          sessionId: session.id,
          tokenFamily: tokenRecord.tokenFamily,
          tokenHash: newHash,
          issuedAt: now,
          expiresAt: newExpiresAt,
        },
      });

      // Mark old token as used and link to replacement
      await tx.refreshToken.update({
        where: { id: tokenRecord.id },
        data: {
          usedAt: now,
          replacedByTokenId: newTokenId,
        },
      });

      return {
        reused: false as const,
        newPlaintextToken: newPlaintext,
        sessionId: session.id,
        userId: session.userId,
      };
    });

    if (result.reused) {
      this.logger.warn(
        `Refresh token reuse detected! Token ID: ${result.id}, Family: ${result.tokenFamily}, Session: ${result.sessionId}`,
      );

      // Revoke in Redis for immediate token rejection
      await this.redisService.set(
        `${this.securityConfig.redisPrefixes.sessionRevocationPrefix}${result.sessionId}`,
        'revoked',
        'EX',
        lifetimeSeconds,
      );

      throw new UnauthorizedException('Refresh token reuse detected. Session has been terminated.');
    }

    // Check if session is revoked in Redis
    const isSessionRevokedInRedis = await this.redisService.get(
      `${this.securityConfig.redisPrefixes.sessionRevocationPrefix}${result.sessionId}`,
    );
    if (isSessionRevokedInRedis) {
      throw new UnauthorizedException('Associated session has been revoked.');
    }

    return {
      newPlaintextToken: result.newPlaintextToken,
      sessionId: result.sessionId,
      userId: result.userId,
    };
  }
}
