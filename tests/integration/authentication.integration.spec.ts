import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
import { ConfigService } from '@nestjs/config';
import { parseSecurityConfig } from '@hms/config';
import { AuthenticationService } from '../../apps/api-core/src/modules/identity/application/services/authentication.service';
import { CredentialService } from '../../apps/api-core/src/modules/identity/application/services/credential.service';
import { PasswordService } from '../../apps/api-core/src/modules/identity/application/services/password.service';
import { PasswordPolicyService } from '../../apps/api-core/src/modules/identity/application/services/password-policy.service';
import { LocalBreachedPasswordChecker } from '../../apps/api-core/src/modules/identity/infrastructure/services/local-breached-password-checker';
import { TokenService } from '../../apps/api-core/src/modules/identity/application/services/token.service';
import { SessionService } from '../../apps/api-core/src/modules/identity/application/services/session.service';
import { RefreshTokenService } from '../../apps/api-core/src/modules/identity/application/services/refresh-token.service';
import { AuthThrottleService } from '../../apps/api-core/src/modules/identity/application/services/auth-throttle.service';
import { RedisService } from '../../apps/api-core/src/common/redis/redis.service';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('W1-T03 T04: Authentication, Tokens & Session Service Integration Tests', () => {
  jest.setTimeout(90000);

  let prisma: PrismaClient;
  let redisService: RedisService;
  let authService: AuthenticationService;
  let tokenService: TokenService;
  let sessionService: SessionService;
  let refreshTokenService: RefreshTokenService;
  let credentialService: CredentialService;
  let configService: ConfigService;

  const createdUserIds: string[] = [];
  const createdGroupIds: string[] = [];
  const createdRegionIds: string[] = [];
  const createdCountryIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const createdSessionIds: string[] = [];

  let testGroupId: string;
  let testPropertyId: string;

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();

    const securityConfig = parseSecurityConfig({}, 'test');
    configService = {
      get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
        if (key === 'security') return securityConfig;
        if (key === 'REDIS_HOST') return process.env.REDIS_HOST || 'localhost';
        if (key === 'REDIS_PORT') return process.env.REDIS_PORT || '6379';
        if (key === 'REDIS_PASSWORD')
          return process.env.REDIS_PASSWORD || 'hms_redis_dev_pass_2026';
        if (key === 'CORS_ORIGIN') return 'http://localhost:4200';
        return defaultVal;
      }),
    } as unknown as ConfigService;

    redisService = new RedisService(configService);
    await redisService.onModuleInit();

    const breachedChecker = new LocalBreachedPasswordChecker();
    const passwordService = new PasswordService(configService);
    const passwordPolicyService = new PasswordPolicyService(configService, breachedChecker);

    credentialService = new CredentialService(
      prisma as unknown as PrismaService,
      passwordService,
      passwordPolicyService,
      configService,
    );

    tokenService = new TokenService(configService, redisService);
    sessionService = new SessionService(
      prisma as unknown as PrismaService,
      redisService,
      configService,
    );
    refreshTokenService = new RefreshTokenService(
      prisma as unknown as PrismaService,
      redisService,
      configService,
    );
    const authThrottleService = new AuthThrottleService(redisService, configService);

    authService = new AuthenticationService(
      prisma as unknown as PrismaService,
      credentialService,
      tokenService,
      sessionService,
      refreshTokenService,
      authThrottleService,
      configService,
    );

    // Setup organizational hierarchy for testing actx consistency
    testGroupId = generateUuidV7();
    await prisma.hotelGroup.create({
      data: {
        id: testGroupId,
        code: `HG-AUTH-${Date.now().toString().slice(-6)}`,
        name: 'Auth Test Hotel Group',
        status: 'ACTIVE',
      },
    });
    createdGroupIds.push(testGroupId);

    const regionId = generateUuidV7();
    await prisma.region.create({
      data: {
        id: regionId,
        hotelGroupId: testGroupId,
        code: `REG-AUTH-${Date.now().toString().slice(-6)}`,
        name: 'Auth Test Region',
        status: 'ACTIVE',
      },
    });
    createdRegionIds.push(regionId);

    const countryId = generateUuidV7();
    await prisma.country.create({
      data: {
        id: countryId,
        regionId,
        code: `CN-AUTH-${Date.now().toString().slice(-4)}`,
        name: 'Auth Test Country',
        status: 'ACTIVE',
      },
    });
    createdCountryIds.push(countryId);

    testPropertyId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: testPropertyId,
        countryId,
        code: `PROP-AUTH-${Date.now().toString().slice(-6)}`,
        name: 'Auth Test Property',
        status: 'ACTIVE',
        timeZone: 'UTC',
        currency: 'USD',
      },
    });
    createdPropertyIds.push(testPropertyId);
  });

  afterAll(async () => {
    try {
      for (const sId of createdSessionIds) {
        await prisma.refreshToken.deleteMany({ where: { sessionId: sId } });
        await prisma.authSession.deleteMany({ where: { id: sId } });
        await redisService.del(`revoked:session:${sId}`);
      }

      for (const userId of createdUserIds) {
        await prisma.organizationMembership.deleteMany({ where: { userId } });
        await prisma.passwordHistory.deleteMany({ where: { userId } });
        await prisma.userCredential.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
      }

      for (const pId of createdPropertyIds) {
        await prisma.property.deleteMany({ where: { id: pId } });
      }
      for (const cId of createdCountryIds) {
        await prisma.country.deleteMany({ where: { id: cId } });
      }
      for (const rId of createdRegionIds) {
        await prisma.region.deleteMany({ where: { id: rId } });
      }
      for (const gId of createdGroupIds) {
        await prisma.hotelGroup.deleteMany({ where: { id: gId } });
      }
    } catch {
      // Ignore teardown errors
    }

    await redisService.onModuleDestroy();
    await prisma.$disconnect();
  });

  async function createTestUserWithPassword(password = 'StrongPassword123!'): Promise<{
    userId: string;
    email: string;
  }> {
    const userId = generateUuidV7();
    const email = `authtest-${userId}@enterprise-hms.com`;

    await prisma.user.create({
      data: {
        id: userId,
        email,
        firstName: 'Auth',
        lastName: 'Integration',
        status: 'ACTIVE',
        defaultPropertyId: testPropertyId,
      },
    });
    createdUserIds.push(userId);

    await prisma.organizationMembership.create({
      data: {
        id: generateUuidV7(),
        userId,
        hotelGroupId: testGroupId,
        isPrimary: true,
        status: 'ACTIVE',
      },
    });

    await credentialService.createCredential(userId, password);

    return { userId, email };
  }

  // --------------------------------------------------------------------------
  // 1. Full Login Lifecycle & Transport
  // --------------------------------------------------------------------------
  it('1, 6, 7, 8, 9, 11, 12. should perform complete login lifecycle with RS256 token and hashed refresh token', async () => {
    const password = 'CorrectPassword123!';
    const { userId, email } = await createTestUserWithPassword(password);

    const loginResult = await authService.login({
      email,
      password,
      clientType: 'web',
      deviceInfo: 'Jest Integration Test',
      ipAddress: '127.0.0.1',
    });

    expect(loginResult).toBeDefined();
    expect(loginResult.isWeb).toBe(true);
    expect(loginResult.rawRefreshToken).toBeDefined();
    expect(typeof loginResult.rawRefreshToken).toBe('string');

    // Web response must NOT include refreshToken in JSON payload
    expect((loginResult.response as any).refreshToken).toBeUndefined();
    expect(loginResult.response.accessToken).toBeDefined();
    expect(loginResult.response.tokenType).toBe('Bearer');
    expect(loginResult.response.user.id).toBe(userId);
    expect(loginResult.response.activeContext.hotelGroupId).toBe(testGroupId);
    expect(loginResult.response.activeContext.propertyId).toBe(testPropertyId);

    // 13. Validate access token
    const claims = await tokenService.validateAccessToken(loginResult.response.accessToken);
    expect(claims.sub).toBe(userId);
    expect(claims.actx.hotelGroupId).toBe(testGroupId);
    expect(claims.actx.propertyId).toBe(testPropertyId);
    expect(claims.sid).toBeDefined();

    createdSessionIds.push(claims.sid);

    // 6. AuthSession exists in PostgreSQL
    const session = await prisma.authSession.findUnique({
      where: { id: claims.sid },
    });
    expect(session).not.toBeNull();
    expect(session!.userId).toBe(userId);
    expect(session!.revokedAt).toBeNull();

    // 7, 11. Refresh token is persisted HASHED, NEVER in plaintext
    const tokens = await prisma.refreshToken.findMany({
      where: { sessionId: claims.sid },
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).not.toBe(loginResult.rawRefreshToken);
    expect(tokens[0].tokenHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
    expect(tokens[0].usedAt).toBeNull();
    expect(tokens[0].revokedAt).toBeNull();
  });

  it('Native login should return refreshToken in payload', async () => {
    const password = 'CorrectPassword123!';
    const { email } = await createTestUserWithPassword(password);

    const loginResult = await authService.login({
      email,
      password,
      clientType: 'native',
      deviceInfo: 'iOS Test Client',
      ipAddress: '127.0.0.1',
    });

    expect(loginResult.isWeb).toBe(false);
    expect((loginResult.response as any).refreshToken).toBe(loginResult.rawRefreshToken);
  });

  it('2. should reject invalid credentials with generic authentication error', async () => {
    const { email } = await createTestUserWithPassword('CorrectPassword123!');

    await expect(
      authService.login({
        email,
        password: 'WrongPassword123!',
        ipAddress: '127.0.0.1',
      }),
    ).rejects.toThrow('Authentication failed.');
  });

  // --------------------------------------------------------------------------
  // 2. Token Refresh & Rotation
  // --------------------------------------------------------------------------
  it('23, 24, 25. should rotate refresh token successfully and mark prior token used', async () => {
    const password = 'RotationPassword123!';
    const { email } = await createTestUserWithPassword(password);

    const { rawRefreshToken } = await authService.login({
      email,
      password,
      clientType: 'web',
      ipAddress: '127.0.0.1',
    });

    const refreshResult = await authService.refresh({
      rawRefreshToken,
      clientType: 'web',
      ipAddress: '127.0.0.1',
      origin: 'http://localhost:4200',
    });

    expect(refreshResult).toBeDefined();
    expect(refreshResult.response.accessToken).toBeDefined();
    expect(refreshResult.rawRefreshToken).not.toBe(rawRefreshToken);

    // Old token should be marked as used in PostgreSQL
    const oldHash = refreshTokenService.hashToken(rawRefreshToken);
    const oldRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash: oldHash },
    });
    expect(oldRecord).not.toBeNull();
    expect(oldRecord!.usedAt).not.toBeNull();
    expect(oldRecord!.replacedByTokenId).toBeDefined();

    // 25. Old refresh token cannot be reused normally
    await expect(
      authService.refresh({
        rawRefreshToken,
        clientType: 'web',
        ipAddress: '127.0.0.1',
        origin: 'http://localhost:4200',
      }),
    ).rejects.toThrow(/reuse detected/i);
  });

  // --------------------------------------------------------------------------
  // 3. Reuse Detection & Token Family Revocation
  // --------------------------------------------------------------------------
  it('26. Token reuse detection should revoke entire token family and backing session', async () => {
    const password = 'ReuseDetectionPass123!';
    const { email } = await createTestUserWithPassword(password);

    // Step 1: Initial Login -> Token A
    const loginRes = await authService.login({
      email,
      password,
      clientType: 'web',
      ipAddress: '127.0.0.1',
    });
    const tokenA = loginRes.rawRefreshToken;

    // Step 2: Legitimate rotation -> consumes Token A, yields Token B
    const refreshRes = await authService.refresh({
      rawRefreshToken: tokenA,
      clientType: 'web',
      ipAddress: '127.0.0.1',
      origin: 'http://localhost:4200',
    });
    const tokenB = refreshRes.rawRefreshToken;

    // Step 3: Malicious replay -> Attacker tries to use Token A again!
    await expect(
      authService.refresh({
        rawRefreshToken: tokenA,
        clientType: 'web',
        ipAddress: '127.0.0.1',
        origin: 'http://localhost:4200',
      }),
    ).rejects.toThrow(UnauthorizedException);

    // Step 4: Verify that Token B (and entire family) is now revoked!
    await expect(
      authService.refresh({
        rawRefreshToken: tokenB,
        clientType: 'web',
        ipAddress: '127.0.0.1',
        origin: 'http://localhost:4200',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  // --------------------------------------------------------------------------
  // 4. Genuine Concurrency Safety Test
  // --------------------------------------------------------------------------
  it('30. Concurrent refresh requests for the same token cannot both succeed', async () => {
    const password = 'ConcurrencyTestPass123!';
    const { email } = await createTestUserWithPassword(password);

    const { rawRefreshToken } = await authService.login({
      email,
      password,
      clientType: 'web',
      ipAddress: '127.0.0.1',
    });

    // Execute two concurrent refresh calls presenting the exact same refresh token
    const results = await Promise.allSettled([
      authService.refresh({
        rawRefreshToken,
        clientType: 'web',
        ipAddress: '127.0.0.1',
        origin: 'http://localhost:4200',
      }),
      authService.refresh({
        rawRefreshToken,
        clientType: 'web',
        ipAddress: '127.0.0.1',
        origin: 'http://localhost:4200',
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one must succeed, and the concurrent call must be rejected!
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  // --------------------------------------------------------------------------
  // 5. Logout & Fast Redis Session Revocation
  // --------------------------------------------------------------------------
  it('31, 32, 33, 34, 36. Logout should revoke session in DB and Redis, rejecting subsequent tokens', async () => {
    const password = 'LogoutTestPassword123!';
    const { email } = await createTestUserWithPassword(password);

    const { response, rawRefreshToken } = await authService.login({
      email,
      password,
      clientType: 'web',
      ipAddress: '127.0.0.1',
    });

    const claims = await tokenService.validateAccessToken(response.accessToken);
    const sessionId = claims.sid;

    // Verify token is valid initially
    expect(await tokenService.validateAccessToken(response.accessToken)).toBeDefined();

    // 31. Perform logout
    await authService.logout(sessionId);

    // 32. Verify Redis revocation key exists
    const isRevokedInRedis = await redisService.exists(`revoked:session:${sessionId}`);
    expect(isRevokedInRedis).toBe(1);

    // 33. Subsequent access token validation fails fast via Redis lookup
    await expect(tokenService.validateAccessToken(response.accessToken)).rejects.toThrow(
      'Session has been revoked.',
    );

    // 34. Subsequent refresh fails
    await expect(
      authService.refresh({
        rawRefreshToken,
        clientType: 'web',
        ipAddress: '127.0.0.1',
        origin: 'http://localhost:4200',
      }),
    ).rejects.toThrow(UnauthorizedException);

    // 36. Repeated logout is safe and idempotent
    await expect(authService.logout(sessionId)).resolves.toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // 6. JWKS Discovery
  // --------------------------------------------------------------------------
  it('22. JWKS endpoint returns valid RFC 7517 public keys without private key exposure', () => {
    const jwks = tokenService.getJwks();
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0].kty).toBe('RSA');
    expect(jwks.keys[0].alg).toBe('RS256');
    expect(jwks.keys[0].kid).toBeDefined();
    expect(jwks.keys[0].n).toBeDefined();
    expect(jwks.keys[0].e).toBeDefined();
    expect(JSON.stringify(jwks)).not.toContain('PRIVATE KEY');
  });
});
