/**
 * Security & IAM Architecture Contracts
 * Baseline: W1-T03 T01
 */

/**
 * Standard JWT Algorithm for Enterprise HMS
 */
export type JwtAlgorithm = 'RS256';

/**
 * Architecturally defined JWT Access Token Claims
 * Strictly adheres to RFC 7519 and W1-T03 Security Architecture
 */
export interface HmsJwtClaims {
  /** Issuer (e.g. 'urn:hms:api') */
  iss: string;
  /** Audience (e.g. 'urn:hms:client') */
  aud: string;
  /** Subject: User ID (UUIDv7) */
  sub: string;
  /** JWT ID: Unique token identifier (UUIDv7) */
  jti: string;
  /** Session ID: Auth session backing record (UUIDv7) */
  sid: string;
  /** Key ID: Identifying active RSA key in JWKS */
  kid: string;
  /** Active Tenant Context snapshot */
  actx: {
    hotelGroupId?: string;
    propertyId?: string;
  };
  /** Issued At timestamp (epoch seconds) */
  iat: number;
  /** Expiration timestamp (epoch seconds) */
  exp: number;
  /** Not Before timestamp (epoch seconds) */
  nbf?: number;
}

/**
 * JWKS (JSON Web Key Set) Public Key Representation (RFC 7517)
 */
export interface JwkPublicKey {
  kty: 'RSA';
  use: 'sig';
  alg: 'RS256';
  kid: string;
  n: string;
  e: string;
}

export interface JwksResponse {
  keys: JwkPublicKey[];
}

/**
 * Scope Types for IAM
 */
export type ScopeType = 'GLOBAL' | 'GROUP' | 'REGION' | 'COUNTRY' | 'PROPERTY' | 'DEPARTMENT';

/**
 * Standard Department Codes
 */
export type DepartmentCode =
  | 'MANAGEMENT'
  | 'FRONT_OFFICE'
  | 'HOUSEKEEPING'
  | 'MAINTENANCE'
  | 'REVENUE_FINANCE'
  | 'FOOD_BEVERAGE'
  | 'SALES_MARKETING'
  | 'SECURITY'
  | 'SPA_LEISURE'
  | 'IT_SYSTEMS';

export * from './security-context.contract';
