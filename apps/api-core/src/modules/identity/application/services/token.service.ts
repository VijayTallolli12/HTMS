import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { SecurityConfig } from '@hms/config';
import { generateUuidV7 } from '@hms/shared';
import { HmsJwtClaims, JwksResponse, ActiveAuthContext } from '@hms/api-contracts';
import { RedisService } from '../../../../common/redis/redis.service';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly securityConfig: SecurityConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const config = this.configService.get<SecurityConfig>('security');
    if (!config) {
      throw new Error('[TokenService] Security configuration missing from ConfigService.');
    }
    this.securityConfig = config;
  }

  /**
   * Issues an RS256-signed JWT access token.
   *
   * Standards & Claims:
   * - JOSE Header: { alg: "RS256", typ: "JWT", kid: "<keyId>" }
   * - Payload Claims: iss, aud, sub, jti, sid, kid, actx, iat, exp
   * - Lifetime: Configuration-driven (default 900s / 15m)
   */
  async issueAccessToken(params: {
    userId: string;
    sessionId: string;
    actx: ActiveAuthContext;
  }): Promise<{ accessToken: string; expiresIn: number }> {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = this.securityConfig.jwt.accessTokenExpiresInSeconds;
    const exp = now + expiresIn;
    const jti = generateUuidV7();
    const kid = this.securityConfig.jwt.keyId;

    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid,
    };

    const claims: HmsJwtClaims = {
      iss: this.securityConfig.jwt.issuer,
      aud: this.securityConfig.jwt.audience,
      sub: params.userId,
      jti,
      sid: params.sessionId,
      kid, // Preserved in claims for T01 HmsJwtClaims compatibility
      actx: params.actx,
      iat: now,
      exp,
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto.sign(
      'RSA-SHA256',
      Buffer.from(dataToSign),
      this.securityConfig.jwt.privateKey,
    );
    const encodedSignature = signature.toString('base64url');

    return {
      accessToken: `${dataToSign}.${encodedSignature}`,
      expiresIn,
    };
  }

  /**
   * Validates an RS256 JWT access token locally and verifies session revocation via Redis.
   *
   * Fast verification: Local cryptographic verification without PostgreSQL database queries.
   * Explicitly rejects: HS256, none, unknown algorithms, expired tokens, signature mismatches,
   * issuer/audience mismatches, or revoked sessions in Redis.
   */
  async validateAccessToken(token: string): Promise<HmsJwtClaims> {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Authentication token is missing or malformed.');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Malformed token structure.');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    let header: Record<string, unknown>;
    let payload: Record<string, unknown>;

    try {
      header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Invalid token encoding.');
    }

    // Explicit algorithm validation — only RS256 is permitted
    if (header.alg !== 'RS256') {
      throw new UnauthorizedException(
        `Unsupported or prohibited token algorithm: ${header.alg}. Only RS256 is permitted.`,
      );
    }

    // Cryptographic signature verification using public key
    const dataToVerify = `${encodedHeader}.${encodedPayload}`;
    let isSignatureValid = false;

    try {
      isSignatureValid = crypto.verify(
        'RSA-SHA256',
        Buffer.from(dataToVerify),
        this.securityConfig.jwt.publicKey,
        Buffer.from(encodedSignature, 'base64url'),
      );
    } catch (err: any) {
      this.logger.debug(`Token signature verification failure: ${err.message}`);
      throw new UnauthorizedException('Token signature verification failed.');
    }

    if (!isSignatureValid) {
      throw new UnauthorizedException('Invalid token signature.');
    }

    // Standard claims verification
    if (payload.iss !== this.securityConfig.jwt.issuer) {
      throw new UnauthorizedException('Token issuer mismatch.');
    }

    if (payload.aud !== this.securityConfig.jwt.audience) {
      throw new UnauthorizedException('Token audience mismatch.');
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || now >= payload.exp) {
      throw new UnauthorizedException('Token has expired.');
    }

    if (typeof payload.nbf === 'number' && now < payload.nbf) {
      throw new UnauthorizedException('Token not active yet.');
    }

    if (!payload.sub || !payload.sid || !payload.jti) {
      throw new UnauthorizedException('Required token claims are missing.');
    }

    // Fast Redis session-revocation lookup without PostgreSQL access
    const isRevoked = await this.redisService.exists(
      `${this.securityConfig.redisPrefixes.sessionRevocationPrefix}${payload.sid}`,
    );

    if (isRevoked === 1) {
      throw new UnauthorizedException('Session has been revoked.');
    }

    return payload as unknown as HmsJwtClaims;
  }

  /**
   * Generates standard RFC 7517 JWKS public key set.
   * Strictly exposes ONLY public RSA modulus and exponent with key ID.
   */
  getJwks(): JwksResponse {
    const publicKeyObject = crypto.createPublicKey(this.securityConfig.jwt.publicKey);
    const jwk = publicKeyObject.export({ format: 'jwk' });

    return {
      keys: [
        {
          kty: 'RSA',
          use: 'sig',
          alg: 'RS256',
          kid: this.securityConfig.jwt.keyId,
          n: jwk.n as string,
          e: jwk.e as string,
        },
      ],
    };
  }
}
