// ==============================================================================
// Enterprise HMS — OTA / Channel Manager Contracts
// ==============================================================================

export type ChannelType = 'OTA';
export type ChannelProvider = 'BOOKING_COM' | 'AIRBNB' | 'EXPEDIA' | 'DEMO';

export type ChannelSyncType = 'RESERVATION_INBOUND' | 'RESERVATION_OUTBOUND' | 'AVAILABILITY' | 'RATE' | 'RECONCILIATION';

export type ChannelSyncStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';

export type ChannelConnectionState = 'NOT_CONFIGURED' | 'DEMO_CONNECTED' | 'DISABLED';

export interface ChannelRoomMapping {
  roomTypeId: string;
  externalRoomTypeCode: string;
}

export interface ChannelRateMapping {
  ratePlanId: string;
  externalRatePlanCode: string;
}

/** Configuration for the explicitly simulated DEMO adapter. Never contains provider credentials. */
export interface DemoChannelConfiguration {
  demoOnly: true;
  connectionState: ChannelConnectionState;
  externalPropertyId: string;
  roomMappings: ChannelRoomMapping[];
  rateMappings: ChannelRateMapping[];
}

export type ReservationSyncStatus = 'NEW' | 'CONFIRMED' | 'MODIFIED' | 'CANCELLED' | 'ERROR';

export type OtaReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW' | 'CHECKED_IN' | 'CHECKED_OUT';

// ==========================================
// CHANNEL CONFIGURATION
// ==========================================

export interface ChannelConfigDto {
  id: string;
  propertyId: string;
  provider: ChannelProvider;
  name: string;
  enabled: boolean;
  demoOnly: true;
  connectionState: ChannelConnectionState;
  configuration: DemoChannelConfiguration;
  fieldMapping: Record<string, string>;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChannelConfigDto {
  provider: ChannelProvider;
  name: string;
  configuration: Record<string, any>;
  fieldMapping?: Record<string, string>;
}

export interface UpdateChannelConfigDto {
  name?: string;
  configuration?: Record<string, any>;
  fieldMapping?: Record<string, string>;
  enabled?: boolean;
}

// ==========================================
// OTA RESERVATION (Normalized)
// ==========================================

export interface OtaReservationDto {
  externalId: string;
  provider: ChannelProvider;
  propertyId: string;
  status: OtaReservationStatus;
  guest: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    nationality?: string;
    documentType?: string;
    documentNumber?: string;
  };
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children?: number;
  roomTypeCode?: string;
  ratePlanCode?: string;
  totalAmount: number;
  currency: string;
  commission?: number;
  specialRequests?: string;
  sourceReservationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InboundReservationDto {
  reservation: OtaReservationDto;
  idempotencyKey: string;
  correlationId: string;
}

// ==========================================
// AVAILABILITY / RATE SYNC
// ==========================================

export interface ChannelAvailabilityDto {
  date: string;
  roomTypeCode: string;
  available: number;
  stopSell: boolean;
  minStay?: number;
  maxStay?: number;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}

export interface ChannelRateDto {
  date: string;
  roomTypeCode: string;
  ratePlanCode: string;
  baseRate: number;
  currency: string;
  overrides?: Record<string, number>;
}

export interface BulkAvailabilityRateDto {
  propertyId: string;
  provider: ChannelProvider;
  availability: ChannelAvailabilityDto[];
  rates: ChannelRateDto[];
}

// ==========================================
// SYNC LOGS & RECONCILIATION
// ==========================================

export interface ChannelSyncLogDto {
  id: string;
  channelConfigId: string;
  propertyId: string;
  syncType: ChannelSyncType;
  status: ChannelSyncStatus;
  recordsProcessed: number;
  recordsFailed: number;
  attemptCount: number;
  retryOfId: string | null;
  errorMessage: string | null;
  correlationId: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface ChannelAvailabilityRateSyncDto {
  startDate: string;
  endDate: string;
  /** Test-only transient failure switch; the DEMO adapter fails once, then succeeds on retry. */
  simulateTransientFailure?: boolean;
  /** Force both automatic attempts to fail so the UI can demonstrate manual retry. */
  simulatePermanentFailure?: boolean;
}

export interface ChannelAvailabilityRateSyncResult {
  demoOnly: true;
  processed: number;
  failed: number;
  attempts: number;
  availabilityProcessed: number;
  ratesProcessed: number;
}

export interface SimulateInboundReservationDto {
  provider: 'DEMO';
  payload: Record<string, any>;
}

export interface InboundChannelReservationResult {
  demoOnly: true;
  reservationId: string;
  confirmationNumber: string;
  isNew: boolean;
  pmsReservationId: string;
}

export interface ChannelSyncLogQueryDto {
  channelConfigId?: string;
  syncType?: ChannelSyncType;
  status?: ChannelSyncStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface ReconciliationReportDto {
  propertyId: string;
  provider: ChannelProvider;
  periodStart: string;
  periodEnd: string;
  totalPmsReservations: number;
  totalOtaReservations: number;
  matched: number;
  pmsOnly: number;
  otaOnly: number;
  discrepancies: Array<{
    type: 'MISSING_IN_PMS' | 'MISSING_IN_OTA' | 'STATUS_MISMATCH' | 'DATE_MISMATCH' | 'AMOUNT_MISMATCH';
    pmsReservationId?: string;
    otaReservationId?: string;
    details: string;
  }>;
  generatedAt: string;
}

// ==========================================
// CHANNEL ADAPTER INTERFACE
// ==========================================

export interface ChannelAdapter {
  provider: 'DEMO';
  readonly demoOnly: true;
  normalizeInbound(rawData: any): OtaReservationDto;
  buildOutbound(reservation: any): any;
  buildAvailabilityPayload(data: ChannelAvailabilityDto[]): any;
  buildRatePayload(data: ChannelRateDto[]): any;
  simulateAvailabilityRateDelivery(
    availabilityPayload: any,
    ratePayload: any,
    attempt: number,
    simulateTransientFailure?: boolean,
    simulatePermanentFailure?: boolean,
  ): Promise<{ processed: number; failed: number }>;
  parseResponse(response: any): { success: boolean; externalId?: string; error?: string };
  getHealthCheckPayload(): any;
}

export interface ChannelAdapterRegistry {
  register(adapter: ChannelAdapter): void;
  get(provider: ChannelProvider): ChannelAdapter | undefined;
}