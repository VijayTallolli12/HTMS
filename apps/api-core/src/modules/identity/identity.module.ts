import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { PasswordService } from './application/services/password.service';
import { PasswordPolicyService } from './application/services/password-policy.service';
import { CredentialService } from './application/services/credential.service';
import { TokenService } from './application/services/token.service';
import { SessionService } from './application/services/session.service';
import { RefreshTokenService } from './application/services/refresh-token.service';
import { AuthThrottleService } from './application/services/auth-throttle.service';
import { AuthenticationService } from './application/services/authentication.service';
import { BREACHED_PASSWORD_CHECKER } from './application/interfaces/breached-password-checker.interface';
import { LocalBreachedPasswordChecker } from './infrastructure/services/local-breached-password-checker';
import { AuthController } from './presentation/controllers/auth.controller';
import { JwksController } from './presentation/controllers/jwks.controller';

import { APP_GUARD } from '@nestjs/core';
import { HierarchyValidationService } from './application/services/hierarchy-validation.service';
import { AuthorizationCacheService } from './application/services/authorization-cache.service';
import { AuthorizationService } from './application/services/authorization.service';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { ScopedRbacGuard } from './presentation/guards/scoped-rbac.guard';

@Module({
  controllers: [AuthController, JwksController],
  providers: [
    PrismaService,
    RedisService,
    PasswordService,
    LocalBreachedPasswordChecker,
    {
      provide: BREACHED_PASSWORD_CHECKER,
      useClass: LocalBreachedPasswordChecker,
    },
    PasswordPolicyService,
    CredentialService,
    TokenService,
    SessionService,
    RefreshTokenService,
    AuthThrottleService,
    AuthenticationService,
    HierarchyValidationService,
    AuthorizationCacheService,
    AuthorizationService,
    JwtAuthGuard,
    ScopedRbacGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ScopedRbacGuard,
    },
  ],
  exports: [
    PrismaService,
    RedisService,
    PasswordService,
    PasswordPolicyService,
    CredentialService,
    TokenService,
    SessionService,
    RefreshTokenService,
    AuthThrottleService,
    AuthenticationService,
    BREACHED_PASSWORD_CHECKER,
    HierarchyValidationService,
    AuthorizationCacheService,
    AuthorizationService,
    JwtAuthGuard,
    ScopedRbacGuard,
  ],
})
export class IdentityModule {}
