/**
 * Security Architecture Configuration & Validation
 * Baseline: W1-T03 T01
 */

import * as crypto from 'crypto';

export interface JwtConfig {
  algorithm: 'RS256';
  publicKey: string;
  privateKey: string;
  keyId: string;
  issuer: string;
  audience: string;
  accessTokenExpiresInSeconds: number;
}

export interface RefreshTokenConfig {
  staffExpiresInSeconds: number;
  guestExpiresInSeconds: number;
  reuseDetectionGracePeriodSeconds: number;
}

export interface PasswordPolicyConfig {
  algorithm: 'argon2id';
  memoryCostKiB: number;
  timeCostIterations: number;
  parallelismThreads: number;
  minLength: number;
  maxLength: number;
  historyRetainCount: number;
  breachedCheckEnabled: boolean;
}

export interface ThrottlingConfig {
  ipRateLimitWindowSeconds: number;
  ipRateLimitMaxAttempts: number;
  accountRateLimitWindowSeconds: number;
  accountRateLimitMaxAttempts: number;
  progressiveDelayInitialSeconds: number;
  progressiveDelayMaxSeconds: number;
}

export interface RedisSecurityPrefixes {
  sessionRevocationPrefix: string;
  securityContextPrefix: string;
  authThrottlingPrefix: string;
}

export interface SecurityConfig {
  jwt: JwtConfig;
  refreshToken: RefreshTokenConfig;
  passwordPolicy: PasswordPolicyConfig;
  throttling: ThrottlingConfig;
  redisPrefixes: RedisSecurityPrefixes;
}

// Constant defaults according to approved W1-T03 V3 plan
export const DEFAULT_SECURITY_CONFIG = {
  JWT_ALGORITHM: 'RS256' as const,
  JWT_KEY_ID: 'hms-auth-key-v1',
  JWT_ISSUER: 'urn:hms:api',
  JWT_AUDIENCE: 'urn:hms:client',
  JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS: 900, // 15 minutes
  REFRESH_TOKEN_STAFF_EXPIRES_IN_SECONDS: 28800, // 8 hours
  REFRESH_TOKEN_GUEST_EXPIRES_IN_SECONDS: 2592000, // 30 days
  REFRESH_TOKEN_REUSE_GRACE_PERIOD_SECONDS: 10,
  ARGON2_MEMORY_COST_KIB: 65536, // 64 MB
  ARGON2_TIME_COST_ITERATIONS: 3,
  ARGON2_PARALLELISM_THREADS: 4,
  PASSWORD_MIN_LENGTH: 12,
  PASSWORD_MAX_LENGTH: 128,
  PASSWORD_HISTORY_RETAIN_COUNT: 5,
  THROTTLING_IP_WINDOW_SECONDS: 900, // 15 minutes
  THROTTLING_IP_MAX_ATTEMPTS: 20,
  THROTTLING_ACCOUNT_WINDOW_SECONDS: 900, // 15 minutes
  THROTTLING_ACCOUNT_MAX_ATTEMPTS: 5,
  THROTTLING_PROGRESSIVE_DELAY_INITIAL_SECONDS: 1,
  THROTTLING_PROGRESSIVE_DELAY_MAX_SECONDS: 30,
  REDIS_SESSION_REVOCATION_PREFIX: 'revoked:session:',
  REDIS_SECURITY_CONTEXT_PREFIX: 'security_context:',
  REDIS_AUTH_THROTTLING_PREFIX: 'auth:throttle:',
} as const;

// Safe ephemeral development RSA 2048 keypair generated exclusively for dev/test fallback
let devKeyCache: { publicKey: string; privateKey: string } | null = null;
export function getDevFallbackRsaKeyPair(): { publicKey: string; privateKey: string } {
  if (!devKeyCache) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    devKeyCache = { publicKey, privateKey };
  }
  return devKeyCache;
}

export function parseSecurityConfig(
  env: Record<string, string | undefined>,
  nodeEnv: 'development' | 'test' | 'staging' | 'production',
): SecurityConfig {
  const isProd = nodeEnv === 'production' || nodeEnv === 'staging';

  // 1. JWT Key Pair Validation
  let privateKey = (env.JWT_PRIVATE_KEY || '').trim();
  let publicKey = (env.JWT_PUBLIC_KEY || '').trim();

  // Format PEM if supplied with escaped newlines
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
  if (publicKey.includes('\\n')) {
    publicKey = publicKey.replace(/\\n/g, '\n');
  }

  if (!privateKey || !publicKey) {
    if (isProd) {
      throw new Error(
        '[SecurityConfig] JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required in production and staging environments.',
      );
    }
    // In development or test, safely generate/use ephemeral RSA 2048 keypair
    const fallback = getDevFallbackRsaKeyPair();
    privateKey = fallback.privateKey;
    publicKey = fallback.publicKey;
  }

  // Validate RSA Key format
  if (!privateKey.includes('BEGIN PRIVATE KEY') && !privateKey.includes('BEGIN RSA PRIVATE KEY')) {
    throw new Error(
      '[SecurityConfig] JWT_PRIVATE_KEY must be a valid PEM-encoded RSA private key.',
    );
  }
  if (!publicKey.includes('BEGIN PUBLIC KEY') && !publicKey.includes('BEGIN RSA PUBLIC KEY')) {
    throw new Error('[SecurityConfig] JWT_PUBLIC_KEY must be a valid PEM-encoded RSA public key.');
  }

  // 2. Algorithm validation
  const algorithm = (env.JWT_ALGORITHM || DEFAULT_SECURITY_CONFIG.JWT_ALGORITHM).trim();
  if (algorithm !== 'RS256') {
    throw new Error(
      '[SecurityConfig] Unsupported JWT algorithm: ' + algorithm + '. Only RS256 is permitted.',
    );
  }

  // 3. Token lifetimes
  const accessTokenExpires = parseInt(
    env.JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS ||
      String(DEFAULT_SECURITY_CONFIG.JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS),
    10,
  );
  if (isNaN(accessTokenExpires) || accessTokenExpires < 60 || accessTokenExpires > 3600) {
    throw new Error(
      '[SecurityConfig] JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS must be between 60 and 3600 seconds (got ' +
        accessTokenExpires +
        ').',
    );
  }

  const staffRefreshExpires = parseInt(
    env.REFRESH_TOKEN_STAFF_EXPIRES_IN_SECONDS ||
      String(DEFAULT_SECURITY_CONFIG.REFRESH_TOKEN_STAFF_EXPIRES_IN_SECONDS),
    10,
  );
  if (isNaN(staffRefreshExpires) || staffRefreshExpires < 3600 || staffRefreshExpires > 86400 * 7) {
    throw new Error(
      '[SecurityConfig] REFRESH_TOKEN_STAFF_EXPIRES_IN_SECONDS must be between 1 hour and 7 days (got ' +
        staffRefreshExpires +
        ').',
    );
  }

  const guestRefreshExpires = parseInt(
    env.REFRESH_TOKEN_GUEST_EXPIRES_IN_SECONDS ||
      String(DEFAULT_SECURITY_CONFIG.REFRESH_TOKEN_GUEST_EXPIRES_IN_SECONDS),
    10,
  );
  if (
    isNaN(guestRefreshExpires) ||
    guestRefreshExpires < 86400 ||
    guestRefreshExpires > 86400 * 90
  ) {
    throw new Error(
      '[SecurityConfig] REFRESH_TOKEN_GUEST_EXPIRES_IN_SECONDS must be between 1 day and 90 days (got ' +
        guestRefreshExpires +
        ').',
    );
  }

  // 4. Password Policy Parameters
  const memoryCostKiB = parseInt(
    env.ARGON2_MEMORY_COST_KIB || String(DEFAULT_SECURITY_CONFIG.ARGON2_MEMORY_COST_KIB),
    10,
  );
  if (isNaN(memoryCostKiB) || memoryCostKiB < 16384) {
    throw new Error(
      '[SecurityConfig] ARGON2_MEMORY_COST_KIB must be at least 16384 KiB (got ' +
        memoryCostKiB +
        ').',
    );
  }

  const timeCostIterations = parseInt(
    env.ARGON2_TIME_COST_ITERATIONS || String(DEFAULT_SECURITY_CONFIG.ARGON2_TIME_COST_ITERATIONS),
    10,
  );
  if (isNaN(timeCostIterations) || timeCostIterations < 2 || timeCostIterations > 10) {
    throw new Error(
      '[SecurityConfig] ARGON2_TIME_COST_ITERATIONS must be between 2 and 10 (got ' +
        timeCostIterations +
        ').',
    );
  }

  const parallelismThreads = parseInt(
    env.ARGON2_PARALLELISM_THREADS || String(DEFAULT_SECURITY_CONFIG.ARGON2_PARALLELISM_THREADS),
    10,
  );
  if (isNaN(parallelismThreads) || parallelismThreads < 1 || parallelismThreads > 16) {
    throw new Error(
      '[SecurityConfig] ARGON2_PARALLELISM_THREADS must be between 1 and 16 (got ' +
        parallelismThreads +
        ').',
    );
  }

  const minLength = parseInt(
    env.PASSWORD_MIN_LENGTH || String(DEFAULT_SECURITY_CONFIG.PASSWORD_MIN_LENGTH),
    10,
  );
  if (isNaN(minLength) || minLength < 12) {
    throw new Error(
      '[SecurityConfig] PASSWORD_MIN_LENGTH must be at least 12 characters (got ' +
        minLength +
        ').',
    );
  }

  const maxLength = parseInt(
    env.PASSWORD_MAX_LENGTH || String(DEFAULT_SECURITY_CONFIG.PASSWORD_MAX_LENGTH),
    10,
  );
  if (isNaN(maxLength) || maxLength > 128 || maxLength <= minLength) {
    throw new Error(
      '[SecurityConfig] PASSWORD_MAX_LENGTH must be greater than minLength and at most 128 (got ' +
        maxLength +
        ').',
    );
  }

  return {
    jwt: {
      algorithm: 'RS256',
      publicKey,
      privateKey,
      keyId: (env.JWT_KEY_ID || DEFAULT_SECURITY_CONFIG.JWT_KEY_ID).trim(),
      issuer: (env.JWT_ISSUER || DEFAULT_SECURITY_CONFIG.JWT_ISSUER).trim(),
      audience: (env.JWT_AUDIENCE || DEFAULT_SECURITY_CONFIG.JWT_AUDIENCE).trim(),
      accessTokenExpiresInSeconds: accessTokenExpires,
    },
    refreshToken: {
      staffExpiresInSeconds: staffRefreshExpires,
      guestExpiresInSeconds: guestRefreshExpires,
      reuseDetectionGracePeriodSeconds:
        DEFAULT_SECURITY_CONFIG.REFRESH_TOKEN_REUSE_GRACE_PERIOD_SECONDS,
    },
    passwordPolicy: {
      algorithm: 'argon2id',
      memoryCostKiB,
      timeCostIterations,
      parallelismThreads,
      minLength,
      maxLength,
      historyRetainCount: DEFAULT_SECURITY_CONFIG.PASSWORD_HISTORY_RETAIN_COUNT,
      breachedCheckEnabled: env.PASSWORD_BREACHED_CHECK_ENABLED !== 'false',
    },
    throttling: {
      ipRateLimitWindowSeconds: parseInt(
        env.THROTTLING_IP_WINDOW_SECONDS ||
          String(DEFAULT_SECURITY_CONFIG.THROTTLING_IP_WINDOW_SECONDS),
        10,
      ),
      ipRateLimitMaxAttempts: parseInt(
        env.THROTTLING_IP_MAX_ATTEMPTS ||
          String(DEFAULT_SECURITY_CONFIG.THROTTLING_IP_MAX_ATTEMPTS),
        10,
      ),
      accountRateLimitWindowSeconds: parseInt(
        env.THROTTLING_ACCOUNT_WINDOW_SECONDS ||
          String(DEFAULT_SECURITY_CONFIG.THROTTLING_ACCOUNT_WINDOW_SECONDS),
        10,
      ),
      accountRateLimitMaxAttempts: parseInt(
        env.THROTTLING_ACCOUNT_MAX_ATTEMPTS ||
          String(DEFAULT_SECURITY_CONFIG.THROTTLING_ACCOUNT_MAX_ATTEMPTS),
        10,
      ),
      progressiveDelayInitialSeconds:
        DEFAULT_SECURITY_CONFIG.THROTTLING_PROGRESSIVE_DELAY_INITIAL_SECONDS,
      progressiveDelayMaxSeconds: DEFAULT_SECURITY_CONFIG.THROTTLING_PROGRESSIVE_DELAY_MAX_SECONDS,
    },
    redisPrefixes: {
      sessionRevocationPrefix: DEFAULT_SECURITY_CONFIG.REDIS_SESSION_REVOCATION_PREFIX,
      securityContextPrefix: DEFAULT_SECURITY_CONFIG.REDIS_SECURITY_CONTEXT_PREFIX,
      authThrottlingPrefix: DEFAULT_SECURITY_CONFIG.REDIS_AUTH_THROTTLING_PREFIX,
    },
  };
}
