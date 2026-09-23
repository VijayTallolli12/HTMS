import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../common/database/prisma.service';
import { CredentialService } from './credential.service';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { RefreshTokenService } from './refresh-token.service';
import { AuthThrottleService } from './auth-throttle.service';
import {
  SafeUserDto,
  ActiveAuthContext,
  WebAuthenticationResponse,
  NativeAuthenticationResponse,
  AuthenticationResponse,
  MeResponse,
  SecurityContext,
  UserRoleSummaryDto,
  UserRoleScopeSummaryDto,
} from '@hms/api-contracts';
import { User } from '@prisma/client';

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialService: CredentialService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly authThrottleService: AuthThrottleService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Resolves the initial active context (actx) for the authenticated user,
   * enforcing strict hierarchy consistency:
   * If propertyId is present, it MUST belong to the selected hotelGroupId.
   */
  async resolveActiveContext(user: User): Promise<ActiveAuthContext> {
    // 1. Determine primary / active hotel group
    const primaryMembership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        deletedAt: null,
        isPrimary: true,
      },
    });

    const membership =
      primaryMembership ||
      (await this.prisma.organizationMembership.findFirst({
        where: {
          userId: user.id,
          status: 'ACTIVE',
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      }));

    const hotelGroupId = membership?.hotelGroupId;
    let propertyId: string | undefined = undefined;

    // 2. Validate default property hierarchy consistency
    if (user.defaultPropertyId && hotelGroupId) {
      const property = await this.prisma.property.findUnique({
        where: { id: user.defaultPropertyId },
        include: {
          country: {
            include: {
              region: true,
            },
          },
        },
      });

      if (property && property.status === 'ACTIVE' && property.deletedAt === null) {
        if (property.country?.region?.hotelGroupId === hotelGroupId) {
          propertyId = property.id;
        } else {
          this.logger.warn(
            `Inconsistent defaultPropertyId (${user.defaultPropertyId}) does not belong to hotelGroupId (${hotelGroupId}) for user ${user.id}. Omitting property from actx.`,
          );
        }
      }
    }

    return {
      hotelGroupId,
      propertyId,
    };
  }

  /**
   * Validates CSRF origin for browser cookie-based refresh requests.
   */
  validateCsrfOrigin(origin?: string, referer?: string): void {
    const trustedOrigin = this.configService.get<string>('CORS_ORIGIN', 'http://localhost:4200');
    let incomingOrigin = origin;

    if (!incomingOrigin && referer) {
      try {
        incomingOrigin = new URL(referer).origin;
      } catch {
        incomingOrigin = undefined;
      }
    }

    if (!incomingOrigin) {
      throw new HttpException('CSRF validation failed: Missing origin.', HttpStatus.FORBIDDEN);
    }

    if (incomingOrigin !== trustedOrigin) {
      throw new HttpException('CSRF validation failed: Origin mismatch.', HttpStatus.FORBIDDEN);
    }
  }

  /**
   * Core login orchestration connecting User, CredentialService, SessionService,
   * RefreshTokenService, TokenService, and AuthThrottleService.
   */
  async login(params: {
    email: string;
    password: string;
    clientType?: 'web' | 'native';
    deviceInfo?: string;
    ipAddress: string;
    userAgent?: string;
  }): Promise<{ response: AuthenticationResponse; isWeb: boolean; rawRefreshToken: string }> {
    const normalizedEmail = (params.email || '').trim().toLowerCase();

    // 1. Dual-axis throttle check
    await this.authThrottleService.assertNotThrottled(params.ipAddress, normalizedEmail);

    // 2. Locate active user
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // 3. User status validation (generic failure response to avoid account enumeration)
    if (!user || user.deletedAt !== null || user.status !== 'ACTIVE') {
      await this.authThrottleService.recordFailedAttempt(params.ipAddress, normalizedEmail);
      throw new UnauthorizedException('Authentication failed.');
    }

    // 4. Verify password via CredentialService
    const isPasswordValid = await this.credentialService.verifyCredential(user.id, params.password);
    if (!isPasswordValid) {
      await this.authThrottleService.recordFailedAttempt(params.ipAddress, normalizedEmail);
      throw new UnauthorizedException('Authentication failed.');
    }

    // 5. Successful password verification -> reset account throttle
    await this.authThrottleService.resetAccountThrottle(normalizedEmail);

    // 6. Resolve active context with hierarchy consistency check
    const actx = await this.resolveActiveContext(user);

    // 7. Create server-side AuthSession
    const session = await this.sessionService.createSession({
      userId: user.id,
      deviceInfo: params.deviceInfo,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    // 8. Generate and persist initial hashed RefreshToken
    const { plaintextToken } = await this.refreshTokenService.createInitialRefreshToken(session.id);

    // 9. Issue RS256 Access Token
    const { accessToken, expiresIn } = await this.tokenService.issueAccessToken({
      userId: user.id,
      sessionId: session.id,
      actx,
    });

    // 10. Update user login metadata
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        failedLoginCount: 0,
      },
    });

    const isWeb = params.clientType !== 'native';
    const safeUser: SafeUserDto = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      defaultPropertyId: user.defaultPropertyId,
    };

    const baseResponse: WebAuthenticationResponse = {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: safeUser,
      activeContext: actx,
    };

    const response: AuthenticationResponse = isWeb
      ? baseResponse
      : ({ ...baseResponse, refreshToken: plaintextToken } as NativeAuthenticationResponse);

    return {
      response,
      isWeb,
      rawRefreshToken: plaintextToken,
    };
  }

  /**
   * Refresh token rotation orchestration.
   * Enforces single-use semantics, concurrency safety, and CSRF origin validation for web clients.
   */
  async refresh(params: {
    rawRefreshToken: string;
    clientType?: 'web' | 'native';
    ipAddress: string;
    origin?: string;
    referer?: string;
  }): Promise<{ response: AuthenticationResponse; isWeb: boolean; rawRefreshToken: string }> {
    const isWeb = params.clientType !== 'native';

    // 1. CSRF Origin Validation for browser cookie refresh
    if (isWeb) {
      this.validateCsrfOrigin(params.origin, params.referer);
    }

    // 2. Rotate refresh token with PostgreSQL row locking and reuse detection
    const { newPlaintextToken, sessionId, userId } =
      await this.refreshTokenService.rotateRefreshToken(params.rawRefreshToken);

    // 3. Verify user active status
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt !== null || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is no longer active.');
    }

    // 4. Resolve active context
    const actx = await this.resolveActiveContext(user);

    // 5. Issue new RS256 access token
    const { accessToken, expiresIn } = await this.tokenService.issueAccessToken({
      userId: user.id,
      sessionId,
      actx,
    });

    const safeUser: SafeUserDto = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      defaultPropertyId: user.defaultPropertyId,
    };

    const baseResponse: WebAuthenticationResponse = {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: safeUser,
      activeContext: actx,
    };

    const response: AuthenticationResponse = isWeb
      ? baseResponse
      : ({ ...baseResponse, refreshToken: newPlaintextToken } as NativeAuthenticationResponse);

    return {
      response,
      isWeb,
      rawRefreshToken: newPlaintextToken,
    };
  }

  /**
   * Logs out a session, revoking it in both PostgreSQL and Redis.
   */
  async logout(sessionId: string): Promise<void> {
    if (sessionId) {
      await this.sessionService.revokeSession(sessionId, 'USER_LOGOUT');
    }
  }

  /**
   * Retrieves safe identity snapshot and active context for the current session.
   */
  async getMe(
    userId: string,
    sessionId: string,
    securityContext?: SecurityContext,
  ): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt !== null || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is no longer active.');
    }

    const actx = await this.resolveActiveContext(user);

    const roles: UserRoleSummaryDto[] =
      securityContext?.roles?.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
      })) ?? [];

    const roleScopes: UserRoleScopeSummaryDto[] =
      securityContext?.scopes?.map((s) => ({
        scopeType: s.scopeType,
        hotelGroupId: s.hotelGroupId,
        regionId: s.regionId,
        countryId: s.countryId,
        propertyId: s.propertyId,
        departmentCode: s.departmentCode,
        roleCode: s.roleCode,
      })) ?? [];

    const permissions: string[] = securityContext?.permissions
      ? Array.from(securityContext.permissions)
      : [];

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        defaultPropertyId: user.defaultPropertyId,
      },
      activeContext: actx,
      sessionId,
      roles,
      roleScopes,
      permissions,
    };
  }
}
