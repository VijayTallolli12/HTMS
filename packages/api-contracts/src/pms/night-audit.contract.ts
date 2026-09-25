/**
 * Night Audit & Hotel Business Date Contracts
 * Domain: Property-scoped hotel business date management, pre-audit operational
 * validations, automated room/tax posting, and date rollover execution.
 */

export enum NightAuditStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum NightAuditStepKey {
  VALIDATION = 'VALIDATION',
  ROOM_CHARGES = 'ROOM_CHARGES',
  NO_SHOW_PROCESSING = 'NO_SHOW_PROCESSING',
  DATE_ROLLOVER = 'DATE_ROLLOVER',
}

export enum NightAuditStepStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export enum ValidationIssueSeverity {
  BLOCKING = 'BLOCKING',
  WARNING = 'WARNING',
}

export interface ValidationIssue {
  code: string;
  category: 'ARRIVALS' | 'DEPARTURES' | 'CASHIERING' | 'ROOM_STATUS' | 'SYSTEM';
  severity: ValidationIssueSeverity;
  message: string;
  details?: Record<string, any>;
  entityId?: string;
  entityReference?: string;
}

export interface PropertyBusinessDateDto {
  propertyId: string;
  currentBusinessDate: string; // 'YYYY-MM-DD'
  previousBusinessDate?: string | null; // 'YYYY-MM-DD'
  systemCalendarDate: string; // 'YYYY-MM-DD'
  propertyTimeZone: string;
  isAuditInProgress: boolean;
  lastAuditRunId?: string | null;
  lastAuditedAt?: string | null;
  daysBehindCalendar: number;
}

export interface NightAuditValidationReportDto {
  propertyId: string;
  businessDate: string;
  evaluatedAt: string;
  canProceed: boolean;
  hasBlockingIssues: boolean;
  hasWarnings: boolean;
  issues: ValidationIssue[];
  metrics: {
    pendingArrivalsCount: number;
    pendingDeparturesCount: number;
    inHouseReservationsCount: number;
    expectedRoomRevenue: number;
    occupiedRoomsCount: number;
    dirtyRoomsCount: number;
  };
}

export interface NightAuditStepDto {
  id: string;
  auditRunId: string;
  stepKey: NightAuditStepKey;
  name: string;
  orderIndex: number;
  status: NightAuditStepStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  itemsProcessed: number;
  details?: Record<string, any> | null;
  errorMessage?: string | null;
}

export interface NightAuditRunDto {
  id: string;
  propertyId: string;
  businessDate: string; // 'YYYY-MM-DD'
  nextBusinessDate: string; // 'YYYY-MM-DD'
  status: NightAuditStatus;
  executedBy: string;
  startedAt: string;
  completedAt?: string | null;
  failureReason?: string | null;
  metrics?: {
    roomRevenuePosted?: number;
    taxPosted?: number;
    roomNightsPosted?: number;
    noShowsProcessed?: number;
    pendingArrivalsAtRollover?: number;
    pendingDeparturesAtRollover?: number;
    [key: string]: any;
  } | null;
  steps?: NightAuditStepDto[];
  version: number;
  createdAt: string;
}

export interface RunNightAuditRequest {
  /** If true, allows audit to proceed despite non-blocking warnings */
  overrideWarnings?: boolean;
  /** Mandatory operational justification when overriding validation warnings */
  overrideReason?: string;
}

export interface NightAuditRecoveryRequest {
  reason: string;
}

export interface NightAuditStatusDto {
  businessDate: PropertyBusinessDateDto;
  isAuditInProgress: boolean;
  activeRun?: NightAuditRunDto | null;
  lastCompletedRun?: NightAuditRunDto | null;
}

