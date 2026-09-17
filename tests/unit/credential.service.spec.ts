import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CredentialService } from '../../apps/api-core/src/modules/identity/application/services/credential.service';
import { PasswordService } from '../../apps/api-core/src/modules/identity/application/services/password.service';
import { PasswordPolicyService } from '../../apps/api-core/src/modules/identity/application/services/password-policy.service';
import { LocalBreachedPasswordChecker } from '../../apps/api-core/src/modules/identity/infrastructure/services/local-breached-password-checker';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { parseSecurityConfig } from '@hms/config';
import { generateUuidV7 } from '@hms/shared';

describe('CredentialService Unit Tests (W1-T03 T03)', () => {
  let credentialService: CredentialService;
  let passwordService: PasswordService;
  let passwordPolicyService: PasswordPolicyService;
  let prismaMock: any;
  let configService: ConfigService;

  const mockUserId = generateUuidV7();
  const mockInitialHash =
    '$argon2id$v=19$m=65536,p=4,t=3$mockSaltInitial$mockHashInitialValue1234567890';
  const mockNewHash = '$argon2id$v=19$m=65536,p=4,t=3$mockSaltNew$mockHashNewValue1234567890';

  beforeEach(() => {
    const securityConfig = parseSecurityConfig({}, 'test');
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'security') return securityConfig;
        return undefined;
      }),
    } as unknown as ConfigService;

    const breachedChecker = new LocalBreachedPasswordChecker();
    passwordPolicyService = new PasswordPolicyService(configService, breachedChecker);

    passwordService = {
      hash: jest.fn().mockResolvedValue(mockNewHash),
      verify: jest.fn().mockImplementation((password: string, hash: string) => {
        if (password === 'OldPassword123!' && hash === mockInitialHash)
          return Promise.resolve(true);
        if (password === 'CurrentPass123!' && hash === mockInitialHash)
          return Promise.resolve(true);
        if (password === 'HistoryPass1!' && hash.includes('history1')) return Promise.resolve(true);
        if (password === 'HistoryPass2!' && hash.includes('history2')) return Promise.resolve(true);
        if (password === 'NewValidPass123!' && hash === mockNewHash) return Promise.resolve(true);
        return Promise.resolve(false);
      }),
    } as unknown as PasswordService;

    prismaMock = {
      userCredential: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      passwordHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prismaMock);
      }),
    };

    credentialService = new CredentialService(
      prismaMock as unknown as PrismaService,
      passwordService,
      passwordPolicyService,
      configService,
    );
  });

  describe('Credential Creation Lifecycle', () => {
    it('21. Credential creation stores only password hash and returns sanitized DTO', async () => {
      const now = new Date();
      prismaMock.userCredential.create.mockResolvedValue({
        id: generateUuidV7(),
        userId: mockUserId,
        status: 'ACTIVE',
        passwordChangedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const result = await credentialService.createCredential(mockUserId, 'StrongPass12345!');

      // Check DTO properties
      expect(result).toBeDefined();
      expect(result.userId).toBe(mockUserId);
      expect(result.status).toBe('ACTIVE');

      // 27. Password hashes never appear in API-facing DTOs
      expect((result as any).passwordHash).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain('passwordHash');
      expect(JSON.stringify(result)).not.toContain(mockNewHash);

      // Verify Prisma call stored the passwordHash
      expect(prismaMock.userCredential.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          passwordHash: mockNewHash,
          status: 'ACTIVE',
        }),
        select: expect.objectContaining({
          id: true,
          userId: true,
          status: true,
          passwordChangedAt: true,
        }),
      });
    });

    it('22. PasswordChangedAt is populated on creation', async () => {
      const now = new Date();
      prismaMock.userCredential.create.mockResolvedValue({
        id: generateUuidV7(),
        userId: mockUserId,
        status: 'ACTIVE',
        passwordChangedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const result = await credentialService.createCredential(mockUserId, 'StrongPass12345!');
      expect(result.passwordChangedAt).toBe(now.toISOString());
    });
  });

  describe('Credential Verification', () => {
    it('should verify candidate password against active user credential', async () => {
      prismaMock.userCredential.findUnique.mockResolvedValue({
        passwordHash: mockInitialHash,
        status: 'ACTIVE',
      });

      const isValid = await credentialService.verifyCredential(mockUserId, 'CurrentPass123!');
      expect(isValid).toBe(true);

      const isInvalid = await credentialService.verifyCredential(mockUserId, 'WrongPassword123!');
      expect(isInvalid).toBe(false);
    });

    it('should return false if user credential does not exist', async () => {
      prismaMock.userCredential.findUnique.mockResolvedValue(null);

      const isValid = await credentialService.verifyCredential(mockUserId, 'AnyPassword123!');
      expect(isValid).toBe(false);
    });

    it('should return false if user credential status is not ACTIVE (e.g. SUSPENDED or LOCKED)', async () => {
      prismaMock.userCredential.findUnique.mockResolvedValue({
        passwordHash: mockInitialHash,
        status: 'SUSPENDED',
      });

      const isValid = await credentialService.verifyCredential(mockUserId, 'CurrentPass123!');
      expect(isValid).toBe(false);
    });
  });

  describe('Password Change & History Enforcement', () => {
    it('16. should accept new password when it does not match history', async () => {
      const now = new Date();
      prismaMock.userCredential.findUnique.mockResolvedValue({
        id: 'cred-1',
        userId: mockUserId,
        passwordHash: mockInitialHash,
        passwordChangedAt: now,
        status: 'ACTIVE',
      });

      prismaMock.passwordHistory.findMany
        .mockResolvedValueOnce([]) // history query (take: 5)
        .mockResolvedValueOnce([]); // excess query (skip: 5)

      prismaMock.passwordHistory.create.mockResolvedValue({ id: 'hist-1' });
      prismaMock.userCredential.update.mockResolvedValue({
        id: 'cred-1',
        userId: mockUserId,
        status: 'ACTIVE',
        passwordChangedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const result = await credentialService.changePassword(
        mockUserId,
        'CurrentPass123!',
        'NewValidPass123!',
      );

      expect(result.userId).toBe(mockUserId);
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('17. should reject new password that matches the current password', async () => {
      prismaMock.userCredential.findUnique.mockResolvedValue({
        id: 'cred-1',
        userId: mockUserId,
        passwordHash: mockInitialHash,
        passwordChangedAt: new Date(),
        status: 'ACTIVE',
      });

      await expect(
        credentialService.changePassword(mockUserId, 'CurrentPass123!', 'CurrentPass123!'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        credentialService.changePassword(mockUserId, 'CurrentPass123!', 'CurrentPass123!'),
      ).rejects.toThrow('Password was recently used. Please choose a different password.');
    });

    it('18. should reject new password matching a retained history record', async () => {
      prismaMock.userCredential.findUnique.mockResolvedValue({
        id: 'cred-1',
        userId: mockUserId,
        passwordHash: mockInitialHash,
        passwordChangedAt: new Date(),
        status: 'ACTIVE',
      });

      prismaMock.passwordHistory.findMany.mockResolvedValue([
        { id: 'h1', userId: mockUserId, passwordHash: 'hash-history1', createdAt: new Date() },
        { id: 'h2', userId: mockUserId, passwordHash: 'hash-history2', createdAt: new Date() },
      ]);

      await expect(
        credentialService.changePassword(mockUserId, 'CurrentPass123!', 'HistoryPass1!'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        credentialService.changePassword(mockUserId, 'CurrentPass123!', 'HistoryPass1!'),
      ).rejects.toThrow('Password was recently used. Please choose a different password.');
    });

    it('20. should succeed for users with fewer than 5 history records (e.g. 0 or 2)', async () => {
      const now = new Date();
      prismaMock.userCredential.findUnique.mockResolvedValue({
        id: 'cred-1',
        userId: mockUserId,
        passwordHash: mockInitialHash,
        passwordChangedAt: now,
        status: 'ACTIVE',
      });

      // User has 1 history record
      prismaMock.passwordHistory.findMany
        .mockResolvedValueOnce([
          { id: 'h1', userId: mockUserId, passwordHash: 'hash-history1', createdAt: now },
        ])
        .mockResolvedValueOnce([]); // no excess records

      prismaMock.passwordHistory.create.mockResolvedValue({ id: 'hist-2' });
      prismaMock.userCredential.update.mockResolvedValue({
        id: 'cred-1',
        userId: mockUserId,
        status: 'ACTIVE',
        passwordChangedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const result = await credentialService.changePassword(
        mockUserId,
        'CurrentPass123!',
        'NewValidPass123!',
      );
      expect(result).toBeDefined();
    });

    it('should reject invalid current password with UnauthorizedException', async () => {
      prismaMock.userCredential.findUnique.mockResolvedValue({
        id: 'cred-1',
        userId: mockUserId,
        passwordHash: mockInitialHash,
        passwordChangedAt: new Date(),
        status: 'ACTIVE',
      });

      await expect(
        credentialService.changePassword(
          mockUserId,
          'WrongCurrentPassword123!',
          'NewValidPass123!',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException if user credential does not exist', async () => {
      prismaMock.userCredential.findUnique.mockResolvedValue(null);

      await expect(
        credentialService.changePassword(mockUserId, 'CurrentPass123!', 'NewValidPass123!'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Security Sanitization', () => {
    it('28. Password hashes never appear in error messages', async () => {
      prismaMock.userCredential.findUnique.mockResolvedValue({
        id: 'cred-1',
        userId: mockUserId,
        passwordHash: mockInitialHash,
        status: 'ACTIVE',
      });

      try {
        await credentialService.changePassword(
          mockUserId,
          'WrongCurrentPassword123!',
          'NewValidPass123!',
        );
      } catch (err: any) {
        expect(err.message).not.toContain(mockInitialHash);
        expect(err.message).not.toContain(mockNewHash);
      }
    });

    it('29. Historical hashes never appear in API-facing responses', async () => {
      const metadata = await credentialService.getCredentialMetadata(mockUserId);
      expect((metadata as any).passwordHash).toBeUndefined();
      expect(JSON.stringify(metadata)).not.toContain('passwordHash');
    });
  });
});
