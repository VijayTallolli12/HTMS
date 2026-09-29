import { SetupMilestone, SetupStateType } from '@hms/api-contracts';

export const SETUP_STATES = {
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  INITIALIZING: 'INITIALIZING',
  ACTIVE: 'ACTIVE',
} as const satisfies Record<SetupStateType, SetupStateType>;

export const SETUP_MILESTONES: readonly SetupMilestone[] = [
  'PROPERTY_CREATED',
  'ADMIN_CREATED',
  'ROOM_TYPES_CONFIGURED',
  'ROOMS_CONFIGURED',
  'RATES_CONFIGURED',
  'USERS_CONFIGURED',
  'COMPLETED',
] as const;

/**
 * Role-to-scope mapping for the first administrator:
 * independent hotel -> PROPERTY_GM @ PROPERTY scope,
 * chain -> CORP_ADMIN @ GROUP scope.
 */
export const FIRST_ADMIN_ROLE: Record<'INDEPENDENT' | 'CHAIN', { roleCode: string; scopeType: 'PROPERTY' | 'GROUP' }> = {
  INDEPENDENT: { roleCode: 'PROPERTY_GM', scopeType: 'PROPERTY' },
  CHAIN: { roleCode: 'CORP_ADMIN', scopeType: 'GROUP' },
};

export function mapRoleCodeToScopeType(roleCode: string): 'PROPERTY' | 'GROUP' {
  return roleCode === 'PROPERTY_GM' ? 'PROPERTY' : 'GROUP';
}

/** W2 setup audit event types (SecurityAuditLog.action values). */
export const SETUP_AUDIT_ACTIONS = {
  SETUP_ADMIN_CREATED: 'SETUP_ADMIN_CREATED',
  SETUP_ORGANIZATION_CREATED: 'SETUP_ORGANIZATION_CREATED',
  SETUP_PROPERTY_CREATED: 'SETUP_PROPERTY_CREATED',
  SETUP_PROPERTY_CONFIG_UPDATED: 'SETUP_PROPERTY_CONFIG_UPDATED',
  SETUP_COMPLETED: 'SETUP_COMPLETED',
  DEMO_DATA_IMPORTED: 'DEMO_DATA_IMPORTED',
  DEMO_DATA_RESET: 'DEMO_DATA_RESET',
  DEMO_DATA_REMOVED: 'DEMO_DATA_REMOVED',
  SYSTEM_INSTALLATION_RESET: 'SYSTEM_INSTALLATION_RESET',
} as const;

/** Canonical demo-org keys owned by the Tokyo Grandeur Palace seed. */
export const DEMO_KEYS = {
  hotelGroupCode: 'HG-GLR',
  propertyCode: 'PROP-TYO-001',
  emailDomain: '@tokyograndeur.demo',
  confirmationPrefix: 'DEMO-',
} as const;
