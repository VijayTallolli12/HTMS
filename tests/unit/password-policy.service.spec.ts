import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordPolicyService } from '../../apps/api-core/src/modules/identity/application/services/password-policy.service';
import { LocalBreachedPasswordChecker } from '../../apps/api-core/src/modules/identity/infrastructure/services/local-breached-password-checker';
import { parseSecurityConfig } from '@hms/config';

describe('PasswordPolicyService & BreachedPasswordChecker (W1-T03 T03)', () => {
  let service: PasswordPolicyService;
  let checker: LocalBreachedPasswordChecker;
  let configService: ConfigService;

  beforeEach(() => {
    const securityConfig = parseSecurityConfig({}, 'test');
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'security') return securityConfig;
        return undefined;
      }),
    } as unknown as ConfigService;

    checker = new LocalBreachedPasswordChecker();
    service = new PasswordPolicyService(configService, checker);
  });

  describe('Password Policy Length & Character Validation', () => {
    it('7. should reject an 11-character password (below minLength 12)', () => {
      const result = service.validate('ShortPass1!'); // 11 chars
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('at least 12 characters');
    });

    it('8. should accept a 12-character password (exact minLength 12)', () => {
      const result = service.validate('ValidPass12!'); // 12 chars
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('9. should accept a 128-character password (exact maxLength 128)', () => {
      const longPass = 'A'.repeat(128);
      const result = service.validate(longPass);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('10. should reject a 129-character password (above maxLength 128)', () => {
      const tooLongPass = 'A'.repeat(129);
      const result = service.validate(tooLongPass);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('must not exceed 128 characters');
    });

    it('11. should reject empty, null, undefined, or non-string passwords', () => {
      const emptyResult = service.validate('');
      expect(emptyResult.valid).toBe(false);
      expect(emptyResult.errors![0]).toContain('non-empty string');

      const nullResult = service.validate(null);
      expect(nullResult.valid).toBe(false);

      const undefinedResult = service.validate(undefined);
      expect(undefinedResult.valid).toBe(false);

      const numberResult = service.validate(123456789012 as any);
      expect(numberResult.valid).toBe(false);
    });

    it('12. should handle valid Unicode passwords correctly without corrupting length', () => {
      // 12 Unicode emoji / multibyte characters
      const unicodePass = '🏨🏨🏨🏨🏨🏨🏨🏨🏨🏨🏨🏨'; // 12 emojis
      const result = service.validate(unicodePass);
      expect(result.valid).toBe(true);

      // 11 emojis should fail
      const shortUnicode = '🏨🏨🏨🏨🏨🏨🏨🏨🏨🏨🏨'; // 11 emojis
      const shortResult = service.validate(shortUnicode);
      expect(shortResult.valid).toBe(false);
    });

    it('should throw BadRequestException via validateOrThrow on violation', () => {
      expect(() => service.validateOrThrow('short')).toThrow(BadRequestException);
      expect(() => service.validateOrThrow('ValidPassword123!')).not.toThrow();
    });
  });

  describe('Common / Breached Password Protection', () => {
    it('13. should reject a known weak/common breached password', async () => {
      const isBreached = await service.isBreached('password123456');
      expect(isBreached).toBe(true);

      await expect(service.assertValidAndNotBreached('password123456')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.assertValidAndNotBreached('password123456')).rejects.toThrow(
        /appeared in a known data breach or is too common/,
      );
    });

    it('14. should accept a normal strong test password that is not breached', async () => {
      const strongPass = 'Quantum#Horizon#2026$Shield';
      const isBreached = await service.isBreached(strongPass);
      expect(isBreached).toBe(false);

      await expect(service.assertValidAndNotBreached(strongPass)).resolves.toBeUndefined();
    });

    it('15. should never log or expose plaintext password in error messages', async () => {
      const sensitivePassword = 'SecretCandidatePassword123!';
      try {
        await service.assertValidAndNotBreached('password123456');
      } catch (err: any) {
        expect(err.message).not.toContain('password123456');
        expect(err.message).not.toContain(sensitivePassword);
      }
    });

    it('should skip breached check when breachedCheckEnabled is false', async () => {
      const disabledConfig = parseSecurityConfig(
        { PASSWORD_BREACHED_CHECK_ENABLED: 'false' },
        'test',
      );
      const disabledConfigService = {
        get: jest.fn().mockReturnValue(disabledConfig),
      } as unknown as ConfigService;

      const disabledService = new PasswordPolicyService(disabledConfigService, checker);
      const isBreached = await disabledService.isBreached('password123456');
      expect(isBreached).toBe(false);
    });
  });
});
