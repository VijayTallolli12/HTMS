import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
import { ConfigService } from '@nestjs/config';
import { parseSecurityConfig } from '@hms/config';
import { CredentialService } from '../../apps/api-core/src/modules/identity/application/services/credential.service';
import { PasswordService } from '../../apps/api-core/src/modules/identity/application/services/password.service';
import { PasswordPolicyService } from '../../apps/api-core/src/modules/identity/application/services/password-policy.service';
import { LocalBreachedPasswordChecker } from '../../apps/api-core/src/modules/identity/infrastructure/services/local-breached-password-checker';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('W1-T03 T03: Credential Lifecycle & Password History Integration Tests', () => {
  jest.setTimeout(90000);

  let prisma: PrismaClient;
  let credentialService: CredentialService;
  let passwordService: PasswordService;
  let passwordPolicyService: PasswordPolicyService;
  let configService: ConfigService;

  const createdUserIds: string[] = [];

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();

    const securityConfig = parseSecurityConfig({}, 'test');
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'security') return securityConfig;
        return undefined;
      }),
    } as unknown as ConfigService;

    const breachedChecker = new LocalBreachedPasswordChecker();
    passwordService = new PasswordService(configService);
    passwordPolicyService = new PasswordPolicyService(configService, breachedChecker);

    credentialService = new CredentialService(
      prisma as unknown as PrismaService,
      passwordService,
      passwordPolicyService,
      configService,
    );
  });

  afterAll(async () => {
    try {
      for (const userId of createdUserIds) {
        await prisma.passwordHistory.deleteMany({ where: { userId } });
        await prisma.userCredential.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
      }
    } catch {
      // Ignore teardown errors
    }
    await prisma.$disconnect();
  });

  async function createTestUser(): Promise<string> {
    const userId = generateUuidV7();
    await prisma.user.create({
      data: {
        id: userId,
        email: `test-user-${userId}@enterprise-hms.com`,
        firstName: 'Credential',
        lastName: 'Tester',
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(userId);
    return userId;
  }

  // --------------------------------------------------------------------------
  // 1. Credential Creation & Verification
  // --------------------------------------------------------------------------
  it('21. should create user credential storing only Argon2id hash and returning sanitized DTO', async () => {
    const userId = await createTestUser();
    const initialPassword = 'InitialSecurePassword123!';

    const beforeCreation = new Date();
    const result = await credentialService.createCredential(userId, initialPassword);

    // 21. Credential creation stores only password hash
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.userId).toBe(userId);
    expect(result.status).toBe('ACTIVE');

    // 22. PasswordChangedAt is populated
    expect(result.passwordChangedAt).toBeDefined();
    const changedAtDate = new Date(result.passwordChangedAt);
    expect(changedAtDate.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime() - 2000);

    // 27. Password hashes never appear in API-facing DTOs
    expect((result as any).passwordHash).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain(initialPassword);

    // Check direct database row
    const dbRecord = await prisma.userCredential.findUnique({
      where: { userId },
    });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord!.passwordHash).toMatch(/^\$argon2id\$v=19\$m=65536,p=4,t=3\$/);
    expect(dbRecord!.passwordHash).not.toBe(initialPassword);

    // 26. Existing password verification works
    const isVerified = await credentialService.verifyCredential(userId, initialPassword);
    expect(isVerified).toBe(true);

    const isWrongRejected = await credentialService.verifyCredential(
      userId,
      'IncorrectPassword123!',
    );
    expect(isWrongRejected).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 2. Credential Status Handling
  // --------------------------------------------------------------------------
  it('should return false when verifying credential of inactive or suspended user', async () => {
    const userId = await createTestUser();
    const password = 'SuspendedUserPass123!';
    await credentialService.createCredential(userId, password);

    // Mark credential as SUSPENDED
    await prisma.userCredential.update({
      where: { userId },
      data: { status: 'SUSPENDED' },
    });

    const isVerified = await credentialService.verifyCredential(userId, password);
    expect(isVerified).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 3. Password Change & Current Password Verification
  // --------------------------------------------------------------------------
  it('should reject password change when current password does not match', async () => {
    const userId = await createTestUser();
    const initialPassword = 'CorrectOldPass123!';
    await credentialService.createCredential(userId, initialPassword);

    await expect(
      credentialService.changePassword(userId, 'WrongOldPass123!', 'BrandNewPassword123!'),
    ).rejects.toThrow(UnauthorizedException);

    // Stored password must remain old password
    const verified = await credentialService.verifyCredential(userId, initialPassword);
    expect(verified).toBe(true);
  });

  it('17. should reject new password matching current password', async () => {
    const userId = await createTestUser();
    const currentPassword = 'SamePasswordReused123!';
    await credentialService.createCredential(userId, currentPassword);

    await expect(
      credentialService.changePassword(userId, currentPassword, currentPassword),
    ).rejects.toThrow(BadRequestException);

    await expect(
      credentialService.changePassword(userId, currentPassword, currentPassword),
    ).rejects.toThrow(/Password was recently used/);
  });

  // --------------------------------------------------------------------------
  // 4. Password History Retention (Last 5) & 6th Oldest Reuse
  // --------------------------------------------------------------------------
  it('16, 18, 19, 23. should maintain 5-password history policy and allow 6th-oldest reuse', async () => {
    const userId = await createTestUser();

    // Passwords sequence P0 through P6
    const p0 = 'PasswordHistoryTestP00!';
    const p1 = 'PasswordHistoryTestP01!';
    const p2 = 'PasswordHistoryTestP02!';
    const p3 = 'PasswordHistoryTestP03!';
    const p4 = 'PasswordHistoryTestP04!';
    const p5 = 'PasswordHistoryTestP05!';
    const p6 = 'PasswordHistoryTestP06!';

    // Initial creation: Active is P0
    await credentialService.createCredential(userId, p0);

    // Initial history count is 0
    let historyRecords = await prisma.passwordHistory.findMany({ where: { userId } });
    expect(historyRecords).toHaveLength(0);

    // 23. Change 1: P0 -> P1 (P0 becomes history, active is P1)
    await credentialService.changePassword(userId, p0, p1);
    historyRecords = await prisma.passwordHistory.findMany({ where: { userId } });
    expect(historyRecords).toHaveLength(1);
    expect(await credentialService.verifyCredential(userId, p1)).toBe(true);
    expect(await credentialService.verifyCredential(userId, p0)).toBe(false);

    // Change 2: P1 -> P2
    await credentialService.changePassword(userId, p1, p2);

    // Change 3: P2 -> P3
    await credentialService.changePassword(userId, p2, p3);

    // Change 4: P3 -> P4
    await credentialService.changePassword(userId, p3, p4);

    // Change 5: P4 -> P5
    await credentialService.changePassword(userId, p4, p5);

    // Active password is now P5
    // History contains P4, P3, P2, P1, P0 (5 records retained)
    historyRecords = await prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    expect(historyRecords).toHaveLength(5);

    // 17. Matching current password (P5) is rejected
    await expect(credentialService.changePassword(userId, p5, p5)).rejects.toThrow(
      BadRequestException,
    );

    // 18. Matching most recent history (P4) is rejected
    await expect(credentialService.changePassword(userId, p5, p4)).rejects.toThrow(
      BadRequestException,
    );

    // 18. Matching an older retained history (P1) is rejected
    await expect(credentialService.changePassword(userId, p5, p1)).rejects.toThrow(
      BadRequestException,
    );

    // Change 6: P5 -> P6
    // In this transaction, P5 is added to history, and older records beyond 5 are pruned.
    // So P0 (the 6th-oldest) is pruned from history!
    await credentialService.changePassword(userId, p5, p6);

    const updatedHistory = await prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    expect(updatedHistory).toHaveLength(5);

    // 19. Password matching the 6th-oldest history (P0) is now accepted!
    // because it has aged out of the 5-password history window.
    const reuseResult = await credentialService.changePassword(userId, p6, p0);
    expect(reuseResult).toBeDefined();
    expect(await credentialService.verifyCredential(userId, p0)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 5. Transaction Safety & Rollback
  // --------------------------------------------------------------------------
  it('24, 25. should maintain transaction safety and rollback if error occurs', async () => {
    const userId = await createTestUser();
    const originalPassword = 'OriginalTransactionPass123!';
    await credentialService.createCredential(userId, originalPassword);

    const originalCredential = await prisma.userCredential.findUnique({
      where: { userId },
    });

    // Mock prisma.$transaction to simulate an error halfway through
    const originalTransaction = prisma.$transaction.bind(prisma);
    const brokenPrisma = Object.create(prisma);
    brokenPrisma.$transaction = async (cb: any) => {
      return originalTransaction(async (tx: any) => {
        await cb(tx);
        throw new Error('Simulated database write failure during password change transaction');
      });
    };

    const failingService = new CredentialService(
      brokenPrisma,
      passwordService,
      passwordPolicyService,
      configService,
    );

    await expect(
      failingService.changePassword(userId, originalPassword, 'NewFailingPassword123!'),
    ).rejects.toThrow('Simulated database write failure');

    // Verify state was completely rolled back:
    // 1. Password history must NOT contain a new entry
    const histories = await prisma.passwordHistory.findMany({ where: { userId } });
    expect(histories).toHaveLength(0);

    // 2. UserCredential must still have original passwordHash
    const afterRollback = await prisma.userCredential.findUnique({
      where: { userId },
    });
    expect(afterRollback!.passwordHash).toBe(originalCredential!.passwordHash);
    expect(afterRollback!.passwordChangedAt.getTime()).toBe(
      originalCredential!.passwordChangedAt.getTime(),
    );

    // 3. User can still authenticate with original password
    const verified = await credentialService.verifyCredential(userId, originalPassword);
    expect(verified).toBe(true);
  });
});
