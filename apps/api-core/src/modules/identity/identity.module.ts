import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { PasswordService } from './application/services/password.service';
import { PasswordPolicyService } from './application/services/password-policy.service';
import { CredentialService } from './application/services/credential.service';
import { BREACHED_PASSWORD_CHECKER } from './application/interfaces/breached-password-checker.interface';
import { LocalBreachedPasswordChecker } from './infrastructure/services/local-breached-password-checker';

@Module({
  providers: [
    PrismaService,
    PasswordService,
    LocalBreachedPasswordChecker,
    {
      provide: BREACHED_PASSWORD_CHECKER,
      useClass: LocalBreachedPasswordChecker,
    },
    PasswordPolicyService,
    CredentialService,
  ],
  exports: [PasswordService, PasswordPolicyService, CredentialService, BREACHED_PASSWORD_CHECKER],
})
export class IdentityModule {}
