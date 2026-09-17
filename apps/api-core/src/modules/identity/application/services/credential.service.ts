import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PasswordService } from './password.service';
import { PasswordPolicyService } from './password-policy.service';
import { generateUuidV7 } from '@hms/shared';
import { SecurityConfig } from '@hms/config';
import { UserCredentialDto } from '@hms/api-contracts';

@Injectable()
export class CredentialService {
  private readonly logger = new Logger(CredentialService.name);
  private readonly securityConfig: SecurityConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.get<SecurityConfig>('security');
    if (!config) {
      throw new Error('[CredentialService] Security configuration missing from ConfigService.');
    }
    this.securityConfig = config;
  }

  /**
   * Creates a new password credential for a user.
   *
   * Requirements:
   * - Validates password against policy (12-128 chars, non-empty string)
   * - Checks against known breached/common passwords
   * - Stores ONLY password hash (Argon2id)
   * - Populates passwordChangedAt
   * - Returns safe DTO strictly excluding passwordHash
   */
  async createCredential(userId: string, plaintextPassword: string): Promise<UserCredentialDto> {
    if (!userId || typeof userId !== 'string') {
      throw new BadRequestException('User ID must be provided.');
    }

    // 1. Policy & breached check
    await this.passwordPolicyService.assertValidAndNotBreached(plaintextPassword);

    // 2. Hash password
    const passwordHash = await this.passwordService.hash(plaintextPassword);
    const now = new Date();

    // 3. Persist credential
    const credential = await this.prisma.userCredential.create({
      data: {
        id: generateUuidV7(),
        userId,
        passwordHash,
        passwordChangedAt: now,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        userId: true,
        status: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      id: credential.id,
      userId: credential.userId,
      status: credential.status,
      passwordChangedAt: credential.passwordChangedAt.toISOString(),
      createdAt: credential.createdAt.toISOString(),
      updatedAt: credential.updatedAt.toISOString(),
    };
  }

  /**
   * Changes a user's password in a transaction-safe manner.
   *
   * Requirements:
   * - Verifies current password (unless skipCurrentPasswordCheck is explicitly true, e.g. admin reset)
   * - Validates new password length & policy
   * - Checks new password against breached list
   * - Checks new password against current password and previous 5 passwords in PasswordHistory
   * - Archives previous hash to PasswordHistory
   * - Prunes password history beyond approved retention limit (5 entries)
   * - Updates UserCredential.passwordHash and passwordChangedAt
   * - All operations within a single database transaction
   * - Returns safe DTO strictly excluding passwordHash
   */
  async changePassword(
    userId: string,
    currentPassword: string | null,
    newPassword: string,
    options?: { skipCurrentPasswordCheck?: boolean },
  ): Promise<UserCredentialDto> {
    if (!userId || typeof userId !== 'string') {
      throw new BadRequestException('User ID must be provided.');
    }

    // 1. Find existing credential
    const existing = await this.prisma.userCredential.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException('Credential record not found.');
    }

    // 2. Verify current password if required
    if (!options?.skipCurrentPasswordCheck) {
      if (!currentPassword || typeof currentPassword !== 'string') {
        throw new BadRequestException('Current password is required.');
      }
      const isCurrentValid = await this.passwordService.verify(
        currentPassword,
        existing.passwordHash,
      );
      if (!isCurrentValid) {
        throw new UnauthorizedException('Current password verification failed.');
      }
    }

    // 3. Validate new password policy & breached check
    await this.passwordPolicyService.assertValidAndNotBreached(newPassword);

    // 4. Check that new password is not the same as the current password
    const matchesCurrent = await this.passwordService.verify(newPassword, existing.passwordHash);
    if (matchesCurrent) {
      throw new BadRequestException(
        'Password was recently used. Please choose a different password.',
      );
    }

    // 5. Check password history (last 5 retained records)
    const historyRetainCount = this.securityConfig.passwordPolicy.historyRetainCount; // 5
    const recentHistories =
      (await this.prisma.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: historyRetainCount,
      })) || [];

    for (const history of recentHistories) {
      const matchesHistory = await this.passwordService.verify(newPassword, history.passwordHash);
      if (matchesHistory) {
        throw new BadRequestException(
          'Password was recently used. Please choose a different password.',
        );
      }
    }

    // 6. Hash new password
    const newHash = await this.passwordService.hash(newPassword);
    const now = new Date();

    // 7. Execute atomic database transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      // a. Archive previous hash to PasswordHistory
      await tx.passwordHistory.create({
        data: {
          id: generateUuidV7(),
          userId,
          passwordHash: existing.passwordHash,
          createdAt: existing.passwordChangedAt || now,
        },
      });

      // b. Retention management: Prune historical records beyond the retention count (5)
      const excessHistories = await tx.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: historyRetainCount,
        select: { id: true },
      });

      if (excessHistories.length > 0) {
        await tx.passwordHistory.deleteMany({
          where: { id: { in: excessHistories.map((h) => h.id) } },
        });
      }

      // c. Update UserCredential with new hash and passwordChangedAt
      return tx.userCredential.update({
        where: { userId },
        data: {
          passwordHash: newHash,
          passwordChangedAt: now,
        },
        select: {
          id: true,
          userId: true,
          status: true,
          passwordChangedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return {
      id: updated.id,
      userId: updated.userId,
      status: updated.status,
      passwordChangedAt: updated.passwordChangedAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Verifies candidate password against user's stored credential.
   *
   * Requirements:
   * - Constant-time verification
   * - Returns false if user does not exist or status is not ACTIVE
   * - Never throws unhandled or leaks sensitive data
   */
  async verifyCredential(userId: string, candidatePassword: string): Promise<boolean> {
    if (!userId || !candidatePassword || typeof candidatePassword !== 'string') {
      return false;
    }

    const credential = await this.prisma.userCredential.findUnique({
      where: { userId },
      select: {
        passwordHash: true,
        status: true,
      },
    });

    if (!credential || credential.status !== 'ACTIVE') {
      return false;
    }

    return this.passwordService.verify(candidatePassword, credential.passwordHash);
  }

  /**
   * Gets credential status and metadata without exposing password hash.
   */
  async getCredentialMetadata(
    userId: string,
  ): Promise<{ exists: boolean; status?: string; passwordChangedAt?: string }> {
    if (!userId) {
      return { exists: false };
    }

    const credential = await this.prisma.userCredential.findUnique({
      where: { userId },
      select: {
        status: true,
        passwordChangedAt: true,
      },
    });

    if (!credential) {
      return { exists: false };
    }

    return {
      exists: true,
      status: credential.status,
      passwordChangedAt: credential.passwordChangedAt.toISOString(),
    };
  }
}
