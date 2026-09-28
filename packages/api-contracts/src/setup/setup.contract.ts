/**
 * W2 First-Run Setup — API contracts.
 *
 * The setup flow runs on a virgin database where no user exists yet. Write
 * endpoints are explicitly @Public on the server but guarded by a server-side
 * "virgin database" condition (zero ACTIVE users with credentials), which
 * closes permanently once the first administrator exists.
 */

export type SetupStateType = 'NOT_INITIALIZED' | 'INITIALIZING' | 'ACTIVE';

export type SetupMilestone =
  | 'PROPERTY_CREATED'
  | 'ADMIN_CREATED'
  | 'ROOM_TYPES_CONFIGURED'
  | 'ROOMS_CONFIGURED'
  | 'RATES_CONFIGURED'
  | 'USERS_CONFIGURED'
  | 'COMPLETED';

export type SetupOrganizationType = 'INDEPENDENT' | 'CHAIN';

export interface SetupStatusDto {
  state: SetupStateType;
  milestones: string[];
  /** 0-100 completion over all 7 milestones (incl. COMPLETED). */
  progress: number;
  /** True ONLY when there are zero ACTIVE users with active credentials. */
  bootstrapEligible: boolean;
  hotelGroupId: string | null;
  propertyId: string | null;
  /** True when status was recomputed from data (derived-on-read fallback healed stale milestones). */
  derived: boolean;
  /** Cheap record counts powering setup-mode dashboards. */
  counts: {
    properties: number;
    roomTypes: number;
    rooms: number;
    ratePlans: number;
    users: number;
  };
}

export interface BootstrapAdminRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  /** Required only when organization/property do not exist yet (virgin standalone bootstrap). */
  organizationType?: SetupOrganizationType;
}

export interface BootstrapAdminResponse {
  userId: string;
  email: string;
  roleCode: string;
  scopeType: string;
  /** True when the caller already existed with identical credentials (idempotent replay). */
  idempotentReplay: boolean;
}

export interface SetupOrganizationRequest {
  type: SetupOrganizationType;
  code: string;
  name: string;
  description?: string;
  /** CHAIN: explicit region code. INDEPENDENT: defaults to DEFAULT. */
  regionCode?: string;
  regionName?: string;
  /** ISO 3166-1 alpha-2 country of the (first) property. Required for INDEPENDENT. */
  countryCode: string;
  countryName?: string;
}

export interface SetupOrganizationResponse {
  hotelGroupId: string;
  hotelGroupCode: string;
  regionId: string;
  countryId: string;
  countryCode: string;
  idempotentReplay: boolean;
}

export interface SetupPropertyRequest {
  countryId: string;
  code: string;
  name: string;
  timeZone: string;
  currency: string;
  legalName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
}

export interface SetupPropertyResponse {
  propertyId: string;
  buildingId: string | null;
  floorId: string | null;
  /** Business date ensured for the property (YYYY-MM-DD). */
  businessDate: string | null;
  idempotentReplay: boolean;
}

export interface SetupCompleteResponse {
  state: SetupStateType;
  milestones: string[];
  progress: number;
}

export interface SetupDemoOperationResponse {
  operation: 'LOAD' | 'RESET' | 'REMOVE';
  success: boolean;
  /** Counts of records created/removed per entity, when available. */
  counts: Record<string, number>;
  /** Truncated operational output for diagnostics (never contains secrets). */
  output: string;
  durationMs: number;
}
