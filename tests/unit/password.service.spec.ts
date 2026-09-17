import { PasswordService } from '../../apps/api-core/src/modules/identity/application/services/password.service';
import { ConfigService } from '@nestjs/config';
import { parseSecurityConfig } from '@hms/config';

describe('PasswordService (W1-T03 T03)', () => {
  let service: PasswordService;
  let configService: ConfigService;

  beforeAll(() => {
    const securityConfig = parseSecurityConfig({}, 'test');
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'security') return securityConfig;
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new PasswordService(configService);
  });

  describe('Password Hashing (Argon2id)', () => {
    const plaintext = 'CorrectHorseBatteryStaple!2026';

    it('1. should produce a valid Argon2id hash from a valid password', async () => {
      const hash = await service.hash(plaintext);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('2. should verify the same password successfully against the hash', async () => {
      const hash = await service.hash(plaintext);
      const isValid = await service.verify(plaintext, hash);
      expect(isValid).toBe(true);
    });

    it('3. should return false when verifying a wrong password', async () => {
      const hash = await service.hash(plaintext);
      const isValid = await service.verify('WrongPassword123!', hash);
      expect(isValid).toBe(false);
    });

    it('4. should produce a hash that does not equal the plaintext password', async () => {
      const hash = await service.hash(plaintext);
      expect(hash).not.toBe(plaintext);
      expect(hash).not.toContain(plaintext);
    });

    it('5. should produce a hash adhering to the standard Argon2id encoded format', async () => {
      const hash = await service.hash(plaintext);
      expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,p=4,t=3\$/);
    });

    it('6. should handle malformed or corrupted hashes safely without crashing', async () => {
      // Corrupted base64/salt
      const malformedHash = '$argon2id$v=19$m=65536,t=3,p=4$invalid_salt_and_hash';
      const result1 = await service.verify(plaintext, malformedHash);
      expect(result1).toBe(false);

      // Non-argon2 string
      const nonArgon = 'plain_string_not_a_hash';
      const result2 = await service.verify(plaintext, nonArgon);
      expect(result2).toBe(false);

      // Empty string
      const result3 = await service.verify(plaintext, '');
      expect(result3).toBe(false);

      // Null / undefined / invalid inputs
      const result4 = await service.verify(null as any, malformedHash);
      expect(result4).toBe(false);
      const result5 = await service.verify(plaintext, null as any);
      expect(result5).toBe(false);
    });

    it('should throw an error when attempting to hash an empty or invalid password', async () => {
      await expect(service.hash('')).rejects.toThrow('Password must be a non-empty string.');
      await expect(service.hash(null as any)).rejects.toThrow(
        'Password must be a non-empty string.',
      );
      await expect(service.hash(undefined as any)).rejects.toThrow(
        'Password must be a non-empty string.',
      );
    });
  });
});
