import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticationService } from '../../apps/api-core/src/modules/identity/application/services/authentication.service';
import { CredentialService } from '../../apps/api-core/src/modules/identity/application/services/credential.service';
import { TokenService } from '../../apps/api-core/src/modules/identity/application/services/token.service';
import { SessionService } from '../../apps/api-core/src/modules/identity/application/services/session.service';
import { RefreshTokenService } from '../../apps/api-core/src/modules/identity/application/services/refresh-token.service';
import { AuthThrottleService } from '../../apps/api-core/src/modules/identity/application/services/auth-throttle.service';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { parseSecurityConfig } from '@hms/config';
import { generateUuidV7 } from '@hms/shared';
import { User } from '@prisma/client';

describe('AuthenticationService Unit Tests (W1-T03 T04)', () => {
  let authService: AuthenticationService;
  let prismaMock: any;
  let credentialServiceMock: any;
  let tokenServiceMock: any;
  let sessionServiceMock: any;
  let refreshTokenServiceMock: any;
  let authThrottleServiceMock: any;
  let configService: ConfigService;

  const mockUserId = generateUuidV7();
  const mockGroupId = generateUuidV7();
  const mockPropertyId = generateUuidV7();
  const mockSessionId = generateUuidV7();
  const mockAccessToken = 'mock.rs256.access_token';
  const mockRawRefreshToken = 'mock_raw_refresh_token_string_48_bytes';

  const mockUser: User = {
    id: mockUserId,
    email: 'test@enterprise-hms.com',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: null,
    status: 'ACTIVE',
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    defaultPropertyId: mockPropertyId,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    const securityConfig = parseSecurityConfig({}, 'test');
    configService = {
      get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
        if (key === 'security') return securityConfig;
        if (key === 'CORS_ORIGIN') return 'http://localhost:4200';
        return defaultVal;
      }),
    } as unknown as ConfigService;

    prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ ...mockUser }),
        update: jest.fn().mockResolvedValue({ ...mockUser }),
      },
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mem-1',
          userId: mockUserId,
          hotelGroupId: mockGroupId,
          status: 'ACTIVE',
          isPrimary: true,
          deletedAt: null,
        }),
      },
      property: {
        findUnique: jest.fn().mockResolvedValue({
          id: mockPropertyId,
          status: 'ACTIVE',
          deletedAt: null,
          country: {
            region: {
              hotelGroupId: mockGroupId, // Matches group!
            },
          },
        }),
      },
    };

    credentialServiceMock = {
      verifyCredential: jest.fn().mockResolvedValue(true),
    };

    tokenServiceMock = {
      issueAccessToken: jest.fn().mockResolvedValue({
        accessToken: mockAccessToken,
        expiresIn: 900,
      }),
    };

    sessionServiceMock = {
      createSession: jest.fn().mockResolvedValue({
        id: mockSessionId,
        userId: mockUserId,
        sessionToken: 'token-123',
        expiresAt: new Date(Date.now() + 28800 * 1000),
      }),
      revokeSession: jest.fn().mockResolvedValue(undefined),
    };

    refreshTokenServiceMock = {
      createInitialRefreshToken: jest.fn().mockResolvedValue({
        plaintextToken: mockRawRefreshToken,
        tokenFamily: 'fam-1',
        expiresAt: new Date(Date.now() + 28800 * 1000),
      }),
      rotateRefreshToken: jest.fn().mockResolvedValue({
        newPlaintextToken: 'new_rotated_refresh_token',
        sessionId: mockSessionId,
        userId: mockUserId,
      }),
    };

    authThrottleServiceMock = {
      assertNotThrottled: jest.fn().mockResolvedValue(undefined),
      recordFailedAttempt: jest.fn().mockResolvedValue(undefined),
      resetAccountThrottle: jest.fn().mockResolvedValue(undefined),
    };

    authService = new AuthenticationService(
      prismaMock as unknown as PrismaService,
      credentialServiceMock as unknown as CredentialService,
      tokenServiceMock as unknown as TokenService,
      sessionServiceMock as unknown as SessionService,
      refreshTokenServiceMock as unknown as RefreshTokenService,
      authThrottleServiceMock as unknown as AuthThrottleService,
      configService,
    );
  });

  describe('Login Flow & Security Rules', () => {
    it('1. should succeed with valid credentials and return sanitized response', async () => {
      const result = await authService.login({
        email: 'TEST@ENTERPRISE-HMS.COM ', // Tests normalization
        password: 'ValidPassword123!',
        clientType: 'web',
        ipAddress: '127.0.0.1',
      });

      expect(result).toBeDefined();
      expect(result.isWeb).toBe(true);
      expect(result.response.accessToken).toBe(mockAccessToken);
      expect(result.response.tokenType).toBe('Bearer');
      expect(result.response.user.id).toBe(mockUserId);
      expect(result.response.activeContext.hotelGroupId).toBe(mockGroupId);
      expect(result.response.activeContext.propertyId).toBe(mockPropertyId);

      // 12. Refresh token is NOT included in web response payload
      expect((result.response as any).refreshToken).toBeUndefined();
      expect(JSON.stringify(result.response)).not.toContain('refreshToken');

      // 6. AuthSession is created
      expect(sessionServiceMock.createSession).toHaveBeenCalled();

      // 7. Initial refresh token is created
      expect(refreshTokenServiceMock.createInitialRefreshToken).toHaveBeenCalledWith(mockSessionId);

      // Throttle reset is called
      expect(authThrottleServiceMock.resetAccountThrottle).toHaveBeenCalledWith(
        'test@enterprise-hms.com',
      );
    });

    it('Native login should include refreshToken in payload', async () => {
      const result = await authService.login({
        email: 'test@enterprise-hms.com',
        password: 'ValidPassword123!',
        clientType: 'native',
        ipAddress: '127.0.0.1',
      });

      expect(result.isWeb).toBe(false);
      expect((result.response as any).refreshToken).toBe(mockRawRefreshToken);
    });

    it('2. should reject with generic error on wrong password', async () => {
      credentialServiceMock.verifyCredential.mockResolvedValueOnce(false);

      await expect(
        authService.login({
          email: 'test@enterprise-hms.com',
          password: 'WrongPassword!',
          ipAddress: '127.0.0.1',
        }),
      ).rejects.toThrow('Authentication failed.');

      expect(authThrottleServiceMock.recordFailedAttempt).toHaveBeenCalledWith(
        '127.0.0.1',
        'test@enterprise-hms.com',
      );
    });

    it('3. should reject with generic error on unknown email', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        authService.login({
          email: 'unknown@enterprise-hms.com',
          password: 'Password123!',
          ipAddress: '127.0.0.1',
        }),
      ).rejects.toThrow('Authentication failed.');

      expect(authThrottleServiceMock.recordFailedAttempt).toHaveBeenCalledWith(
        '127.0.0.1',
        'unknown@enterprise-hms.com',
      );
    });

    it('4, 5. should reject suspended or deactivated users with generic error', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        status: 'SUSPENDED',
      });

      await expect(
        authService.login({
          email: 'test@enterprise-hms.com',
          password: 'Password123!',
          ipAddress: '127.0.0.1',
        }),
      ).rejects.toThrow('Authentication failed.');

      expect(credentialServiceMock.verifyCredential).not.toHaveBeenCalled();
    });
  });

  describe('Active Context (actx) Hierarchy Consistency', () => {
    it('should include propertyId when default property belongs to active hotelGroup', async () => {
      const actx = await authService.resolveActiveContext(mockUser);
      expect(actx.hotelGroupId).toBe(mockGroupId);
      expect(actx.propertyId).toBe(mockPropertyId);
    });

    it('should safely omit propertyId when default property belongs to a different hotelGroup', async () => {
      prismaMock.property.findUnique.mockResolvedValueOnce({
        id: mockPropertyId,
        status: 'ACTIVE',
        deletedAt: null,
        country: {
          region: {
            hotelGroupId: 'different-group-id', // Mismatch!
          },
        },
      });

      const actx = await authService.resolveActiveContext(mockUser);
      expect(actx.hotelGroupId).toBe(mockGroupId);
      // Inconsistent propertyId is safely omitted!
      expect(actx.propertyId).toBeUndefined();
    });
  });

  describe('CSRF Origin Validation for Browser Refresh', () => {
    it('should accept browser refresh request from configured trusted origin', () => {
      expect(() => authService.validateCsrfOrigin('http://localhost:4200')).not.toThrow();
    });

    it('should accept browser refresh request with matching Referer', () => {
      expect(() =>
        authService.validateCsrfOrigin(undefined, 'http://localhost:4200/dashboard'),
      ).not.toThrow();
    });

    it('should reject browser refresh request with mismatched origin with 403 Forbidden', () => {
      expect(() => authService.validateCsrfOrigin('http://malicious-attacker.com')).toThrow(
        HttpException,
      );

      try {
        authService.validateCsrfOrigin('http://malicious-attacker.com');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(err.message).toContain('CSRF validation failed');
      }
    });

    it('should reject browser refresh request missing both origin and referer', () => {
      expect(() => authService.validateCsrfOrigin(undefined, undefined)).toThrow(HttpException);
    });
  });
});
