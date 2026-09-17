/**
 * IAM & Identity Domain Contracts
 * Baseline: W1-T03 T02
 */

import { ScopeType, DepartmentCode } from '../security/security.contract';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | 'DEACTIVATED';
export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type SessionStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';
export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'CHALLENGE';
export type ActorType = 'USER' | 'SYSTEM' | 'SERVICE';

export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: UserStatus;
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  defaultPropertyId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface OrganizationMembershipDto {
  id: string;
  userId: string;
  hotelGroupId: string;
  isPrimary: boolean;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface RoleDto {
  id: string;
  hotelGroupId: string | null;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PermissionDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  module: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermissionDto {
  id: string;
  roleId: string;
  permissionId: string;
  createdAt: string;
}

export interface UserRoleScopeDto {
  id: string;
  userId: string;
  roleId: string;
  scopeType: ScopeType;
  hotelGroupId: string | null;
  regionId: string | null;
  countryId: string | null;
  propertyId: string | null;
  departmentCode: DepartmentCode | string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionDto {
  id: string;
  userId: string;
  sessionToken: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RefreshTokenDto {
  id: string;
  sessionId: string;
  tokenFamily: string;
  tokenHash: string;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  replacedByTokenId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityAuditLogDto {
  id: string;
  timestamp: string;
  actorId: string | null;
  actorType: ActorType;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  outcome: AuditOutcome;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  details: Record<string, unknown> | null;
}
