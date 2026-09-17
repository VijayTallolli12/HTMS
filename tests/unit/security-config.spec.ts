import {
  parseSecurityConfig,
  DEFAULT_SECURITY_CONFIG,
  getDevFallbackRsaKeyPair,
} from '@hms/config';

describe('Security Configuration Validation (W1-T03 T01)', () => {
  let sampleRsa: { publicKey: string; privateKey: string };

  beforeAll(() => {
    sampleRsa = getDevFallbackRsaKeyPair();
  });

  describe('Development & Test Configuration Handling', () => {
    it('should parse valid configuration using fallback RSA keypair when keys omitted in development', () => {
      const config = parseSecurityConfig({}, 'development');
      expect(config.jwt.algorithm).toBe('RS256');
      expect(config.jwt.privateKey).toContain('BEGIN PRIVATE KEY');
      expect(config.jwt.publicKey).toContain('BEGIN PUBLIC KEY');
      expect(config.jwt.keyId).toBe(DEFAULT_SECURITY_CONFIG.JWT_KEY_ID);
      expect(config.jwt.issuer).toBe(DEFAULT_SECURITY_CONFIG.JWT_ISSUER);
      expect(config.jwt.audience).toBe(DEFAULT_SECURITY_CONFIG.JWT_AUDIENCE);
      expect(config.jwt.accessTokenExpiresInSeconds).toBe(900);
      expect(config.refreshToken.staffExpiresInSeconds).toBe(28800);
      expect(config.passwordPolicy.algorithm).toBe('argon2id');
      expect(config.passwordPolicy.memoryCostKiB).toBe(65536);
      expect(config.passwordPolicy.minLength).toBe(12);
      expect(config.passwordPolicy.maxLength).toBe(128);
    });

    it('should parse valid configuration in test environment', () => {
      const config = parseSecurityConfig({}, 'test');
      expect(config.jwt.algorithm).toBe('RS256');
      expect(config.jwt.accessTokenExpiresInSeconds).toBe(900);
    });
  });

  describe('Production Fast-Fail Validation', () => {
    it('should throw fast when JWT_PRIVATE_KEY or JWT_PUBLIC_KEY are missing in production', () => {
      expect(() => {
        parseSecurityConfig({}, 'production');
      }).toThrow(/JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required in production and staging/);
    });

    it('should throw fast when JWT_PRIVATE_KEY is missing in staging', () => {
      expect(() => {
        parseSecurityConfig({ JWT_PUBLIC_KEY: sampleRsa.publicKey }, 'staging');
      }).toThrow(/JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required in production and staging/);
    });

    it('should accept valid RSA PEM keys in production', () => {
      const config = parseSecurityConfig(
        {
          JWT_PRIVATE_KEY: sampleRsa.privateKey,
          JWT_PUBLIC_KEY: sampleRsa.publicKey,
          JWT_KEY_ID: 'prod-key-2026',
          JWT_ISSUER: 'urn:hms:api:prod',
          JWT_AUDIENCE: 'urn:hms:client:prod',
        },
        'production',
      );
      expect(config.jwt.keyId).toBe('prod-key-2026');
      expect(config.jwt.issuer).toBe('urn:hms:api:prod');
      expect(config.jwt.audience).toBe('urn:hms:client:prod');
    });

    it('should handle PEM keys formatted with escaped newlines (\\n)', () => {
      const escapedPriv = sampleRsa.privateKey.replace(/\n/g, '\\n');
      const escapedPub = sampleRsa.publicKey.replace(/\n/g, '\\n');
      const config = parseSecurityConfig(
        {
          JWT_PRIVATE_KEY: escapedPriv,
          JWT_PUBLIC_KEY: escapedPub,
        },
        'production',
      );
      expect(config.jwt.privateKey).toContain('\n');
      expect(config.jwt.publicKey).toContain('\n');
    });
  });

  describe('Key Format and Algorithm Validation', () => {
    it('should reject invalid private key PEM format', () => {
      expect(() => {
        parseSecurityConfig(
          {
            JWT_PRIVATE_KEY: 'not-a-pem-key',
            JWT_PUBLIC_KEY: sampleRsa.publicKey,
          },
          'development',
        );
      }).toThrow(/JWT_PRIVATE_KEY must be a valid PEM-encoded/);
    });

    it('should reject invalid public key PEM format', () => {
      expect(() => {
        parseSecurityConfig(
          {
            JWT_PRIVATE_KEY: sampleRsa.privateKey,
            JWT_PUBLIC_KEY: 'not-a-public-key',
          },
          'development',
        );
      }).toThrow(/JWT_PUBLIC_KEY must be a valid PEM-encoded/);
    });

    it('should reject any JWT algorithm other than RS256', () => {
      expect(() => {
        parseSecurityConfig(
          {
            JWT_ALGORITHM: 'HS256',
          },
          'development',
        );
      }).toThrow(/Unsupported JWT algorithm/);

      expect(() => {
        parseSecurityConfig(
          {
            JWT_ALGORITHM: 'none',
          },
          'development',
        );
      }).toThrow(/Unsupported JWT algorithm/);
    });
  });

  describe('Token Lifetime Validation', () => {
    it('should reject access token TTL under 60 seconds', () => {
      expect(() => {
        parseSecurityConfig({ JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS: '30' }, 'development');
      }).toThrow(/JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS must be between 60 and 3600 seconds/);
    });

    it('should reject access token TTL over 3600 seconds (1 hour)', () => {
      expect(() => {
        parseSecurityConfig({ JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS: '7200' }, 'development');
      }).toThrow(/JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS must be between 60 and 3600 seconds/);
    });

    it('should reject invalid staff refresh token lifetime', () => {
      expect(() => {
        parseSecurityConfig({ REFRESH_TOKEN_STAFF_EXPIRES_IN_SECONDS: '600' }, 'development');
      }).toThrow(/REFRESH_TOKEN_STAFF_EXPIRES_IN_SECONDS must be between 1 hour and 7 days/);
    });

    it('should reject invalid guest refresh token lifetime', () => {
      expect(() => {
        parseSecurityConfig({ REFRESH_TOKEN_GUEST_EXPIRES_IN_SECONDS: '3600' }, 'development');
      }).toThrow(/REFRESH_TOKEN_GUEST_EXPIRES_IN_SECONDS must be between 1 day and 90 days/);
    });
  });

  describe('Argon2id and Password Policy Validation', () => {
    it('should reject Argon2 memory cost lower than 16384 KiB (16MB)', () => {
      expect(() => {
        parseSecurityConfig({ ARGON2_MEMORY_COST_KIB: '8192' }, 'development');
      }).toThrow(/ARGON2_MEMORY_COST_KIB must be at least 16384 KiB/);
    });

    it('should reject Argon2 time cost iterations under 2', () => {
      expect(() => {
        parseSecurityConfig({ ARGON2_TIME_COST_ITERATIONS: '1' }, 'development');
      }).toThrow(/ARGON2_TIME_COST_ITERATIONS must be between 2 and 10/);
    });

    it('should reject password min length under 12 characters', () => {
      expect(() => {
        parseSecurityConfig({ PASSWORD_MIN_LENGTH: '8' }, 'development');
      }).toThrow(/PASSWORD_MIN_LENGTH must be at least 12 characters/);
    });

    it('should reject password max length greater than 128 characters', () => {
      expect(() => {
        parseSecurityConfig({ PASSWORD_MAX_LENGTH: '256' }, 'development');
      }).toThrow(/PASSWORD_MAX_LENGTH must be greater than minLength and at most 128/);
    });

    it('should reject password max length less than or equal to min length', () => {
      expect(() => {
        parseSecurityConfig(
          { PASSWORD_MIN_LENGTH: '16', PASSWORD_MAX_LENGTH: '16' },
          'development',
        );
      }).toThrow(/PASSWORD_MAX_LENGTH must be greater than minLength and at most 128/);
    });
  });

  describe('Redis Security Key Concepts', () => {
    it('should define standard prefix constants for session revocation and security context', () => {
      const config = parseSecurityConfig({}, 'development');
      expect(config.redisPrefixes.sessionRevocationPrefix).toBe('revoked:session:');
      expect(config.redisPrefixes.securityContextPrefix).toBe('security_context:');
      expect(config.redisPrefixes.authThrottlingPrefix).toBe('auth:throttle:');
    });
  });
});
