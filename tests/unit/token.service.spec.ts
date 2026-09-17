import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { TokenService } from '../../apps/api-core/src/modules/identity/application/services/token.service';
import { RedisService } from '../../apps/api-core/src/common/redis/redis.service';
import { parseSecurityConfig } from '@hms/config';
import { generateUuidV7 } from '@hms/shared';

describe('TokenService (W1-T03 T04)', () => {
  let tokenService: TokenService;
  let redisMock: any;
  let configService: ConfigService;
  let securityConfig: any;

  const mockUserId = generateUuidV7();
  const mockSessionId = generateUuidV7();
  const mockActx = { hotelGroupId: generateUuidV7(), propertyId: generateUuidV7() };

  beforeAll(() => {
    securityConfig = parseSecurityConfig({}, 'test');
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'security') return securityConfig;
        return undefined;
      }),
    } as unknown as ConfigService;

    redisMock = {
      exists: jest.fn().mockResolvedValue(0), // default: session not revoked
    };

    tokenService = new TokenService(configService, redisMock as unknown as RedisService);
  });

  describe('RS256 Access Token Issuance', () => {
    it('8, 9. should issue a valid RS256 token containing all required claims', async () => {
      const result = await tokenService.issueAccessToken({
        userId: mockUserId,
        sessionId: mockSessionId,
        actx: mockActx,
      });

      expect(result).toBeDefined();
      expect(result.expiresIn).toBe(securityConfig.jwt.accessTokenExpiresInSeconds);
      expect(typeof result.accessToken).toBe('string');

      const parts = result.accessToken.split('.');
      expect(parts).toHaveLength(3);

      // Verify JOSE Header
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      expect(header.alg).toBe('RS256');
      expect(header.typ).toBe('JWT');
      expect(header.kid).toBe(securityConfig.jwt.keyId);

      // Verify Claims Payload
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      expect(payload.iss).toBe(securityConfig.jwt.issuer);
      expect(payload.aud).toBe(securityConfig.jwt.audience);
      expect(payload.sub).toBe(mockUserId);
      expect(payload.sid).toBe(mockSessionId);
      expect(payload.kid).toBe(securityConfig.jwt.keyId);
      expect(payload.actx).toEqual(mockActx);
      expect(payload.jti).toBeDefined();
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBe(payload.iat + securityConfig.jwt.accessTokenExpiresInSeconds);
    });

    it('10. should never expose or return the private key in issued tokens or responses', async () => {
      const result = await tokenService.issueAccessToken({
        userId: mockUserId,
        sessionId: mockSessionId,
        actx: mockActx,
      });

      expect(result.accessToken).not.toContain('PRIVATE KEY');
      expect(JSON.stringify(result)).not.toContain('PRIVATE KEY');
    });
  });

  describe('Access Token Validation & Cryptographic Security', () => {
    it('13. should validate a valid RS256 access token', async () => {
      const { accessToken } = await tokenService.issueAccessToken({
        userId: mockUserId,
        sessionId: mockSessionId,
        actx: mockActx,
      });

      const claims = await tokenService.validateAccessToken(accessToken);
      expect(claims.sub).toBe(mockUserId);
      expect(claims.sid).toBe(mockSessionId);
      expect(claims.actx).toEqual(mockActx);
    });

    it('14. should reject an expired token', async () => {
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(
        JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: securityConfig.jwt.keyId }),
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          iss: securityConfig.jwt.issuer,
          aud: securityConfig.jwt.audience,
          sub: mockUserId,
          sid: mockSessionId,
          jti: generateUuidV7(),
          kid: securityConfig.jwt.keyId,
          actx: mockActx,
          iat: now - 1000,
          exp: now - 100, // Expired
        }),
      ).toString('base64url');

      const sig = crypto
        .sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), securityConfig.jwt.privateKey)
        .toString('base64url');
      const expiredToken = `${header}.${payload}.${sig}`;

      await expect(tokenService.validateAccessToken(expiredToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(tokenService.validateAccessToken(expiredToken)).rejects.toThrow('expired');
    });

    it('15. should reject token with wrong signature', async () => {
      const { accessToken } = await tokenService.issueAccessToken({
        userId: mockUserId,
        sessionId: mockSessionId,
        actx: mockActx,
      });

      const parts = accessToken.split('.');
      // Tamper signature
      const tamperedToken = `${parts[0]}.${parts[1]}.tampered_invalid_signature_bytes`;

      await expect(tokenService.validateAccessToken(tamperedToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('16. should reject token with wrong issuer', async () => {
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(
        JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: securityConfig.jwt.keyId }),
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          iss: 'urn:wrong:issuer',
          aud: securityConfig.jwt.audience,
          sub: mockUserId,
          sid: mockSessionId,
          jti: generateUuidV7(),
          kid: securityConfig.jwt.keyId,
          actx: mockActx,
          iat: now,
          exp: now + 900,
        }),
      ).toString('base64url');

      const sig = crypto
        .sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), securityConfig.jwt.privateKey)
        .toString('base64url');
      const wrongIssuerToken = `${header}.${payload}.${sig}`;

      await expect(tokenService.validateAccessToken(wrongIssuerToken)).rejects.toThrow(
        'issuer mismatch',
      );
    });

    it('17. should reject token with wrong audience', async () => {
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(
        JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: securityConfig.jwt.keyId }),
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          iss: securityConfig.jwt.issuer,
          aud: 'urn:wrong:audience',
          sub: mockUserId,
          sid: mockSessionId,
          jti: generateUuidV7(),
          kid: securityConfig.jwt.keyId,
          actx: mockActx,
          iat: now,
          exp: now + 900,
        }),
      ).toString('base64url');

      const sig = crypto
        .sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), securityConfig.jwt.privateKey)
        .toString('base64url');
      const wrongAudienceToken = `${header}.${payload}.${sig}`;

      await expect(tokenService.validateAccessToken(wrongAudienceToken)).rejects.toThrow(
        'audience mismatch',
      );
    });

    it('18. should explicitly reject HS256 tokens', async () => {
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
        'base64url',
      );
      const payload = Buffer.from(
        JSON.stringify({
          iss: securityConfig.jwt.issuer,
          aud: securityConfig.jwt.audience,
          sub: mockUserId,
          sid: mockSessionId,
          jti: generateUuidV7(),
          actx: mockActx,
          iat: now,
          exp: now + 900,
        }),
      ).toString('base64url');

      const hmac = crypto
        .createHmac('sha256', 'fake-hmac-secret-key')
        .update(`${header}.${payload}`)
        .digest('base64url');
      const hs256Token = `${header}.${payload}.${hmac}`;

      await expect(tokenService.validateAccessToken(hs256Token)).rejects.toThrow(
        /Unsupported or prohibited token algorithm: HS256/,
      );
    });

    it('19. should explicitly reject none algorithm tokens', async () => {
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          iss: securityConfig.jwt.issuer,
          aud: securityConfig.jwt.audience,
          sub: mockUserId,
          sid: mockSessionId,
          jti: generateUuidV7(),
          actx: mockActx,
          iat: now,
          exp: now + 900,
        }),
      ).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      await expect(tokenService.validateAccessToken(noneToken)).rejects.toThrow(
        /Unsupported or prohibited token algorithm: none/,
      );
    });

    it('20. should reject malformed or non-string tokens', async () => {
      await expect(tokenService.validateAccessToken('')).rejects.toThrow(UnauthorizedException);
      await expect(tokenService.validateAccessToken('not-a-jwt')).rejects.toThrow('Malformed');
      await expect(tokenService.validateAccessToken('a.b')).rejects.toThrow('Malformed');
      await expect(tokenService.validateAccessToken(null as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('21. should reject token when session is revoked in Redis', async () => {
      const { accessToken } = await tokenService.issueAccessToken({
        userId: mockUserId,
        sessionId: mockSessionId,
        actx: mockActx,
      });

      // Simulate Redis containing the revoked session key
      redisMock.exists.mockResolvedValueOnce(1);

      await expect(tokenService.validateAccessToken(accessToken)).rejects.toThrow(
        'Session has been revoked.',
      );
    });
  });

  describe('JWKS Public Key Representation', () => {
    it('22. should expose only public key components in standard RFC 7517 JWKS format', () => {
      const jwks = tokenService.getJwks();

      expect(jwks).toBeDefined();
      expect(jwks.keys).toBeDefined();
      expect(jwks.keys).toHaveLength(1);

      const key = jwks.keys[0];
      expect(key.kty).toBe('RSA');
      expect(key.use).toBe('sig');
      expect(key.alg).toBe('RS256');
      expect(key.kid).toBe(securityConfig.jwt.keyId);
      expect(key.n).toBeDefined();
      expect(key.e).toBeDefined();

      // Ensure NO private key fields exist
      expect((key as any).d).toBeUndefined();
      expect((key as any).p).toBeUndefined();
      expect((key as any).q).toBeUndefined();
      expect((key as any).dp).toBeUndefined();
      expect((key as any).dq).toBeUndefined();
      expect((key as any).qi).toBeUndefined();
      expect(JSON.stringify(jwks)).not.toContain('PRIVATE KEY');
    });
  });
});
