// ==============================================================================
// Enterprise HMS — Audit / Activity Center Contracts
// ==============================================================================

export type AuditAction = 
  | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED'
  | 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  | 'CHECK_IN' | 'CHECKOUT' | 'CANCEL'
  | 'ASSIGN_ROOM' | 'UNASSIGN_ROOM'
  | 'POST_CHARGE' | 'RECORD_PAYMENT' | 'REFUND'
  | 'CHANGE_ROOM_STATUS' | 'HOUSEKEEPING_TASK'
  | 'CREATE_WORK_ORDER' | 'UPDATE_WORK_ORDER'
  | 'CREATE_RESERVATION' | 'UPDATE_RESERVATION'
  | 'CONFIGURE_INTEGRATION' | 'SYNC_INTEGRATION'
  | 'PROCESS_PAYMENT' | 'AUTHORIZE_PAYMENT' | 'CAPTURE_PAYMENT' | 'REFUND_PAYMENT'
  | 'SEND_EMAIL' | 'SEND_WHATSAPP'
  | 'RUN_NIGHT_AUDIT' | 'VALIDATE_NIGHT_AUDIT'
  | 'CREATE_USER' | 'UPDATE_USER' | 'DELETE_USER'
  | 'ASSIGN_ROLE' | 'REVOKE_ROLE'
  | 'EXPORT_DATA' | 'IMPORT_DATA';

export type AuditLogEntityType = 
  | 'USER' | 'ROLE' | 'PERMISSION'
  | 'PROPERTY' | 'ROOM' | 'ROOM_TYPE' | 'RATE_PLAN'
  | 'RESERVATION' | 'GUEST' | 'FOLIO' | 'PAYMENT'
  | 'HOUSEKEEPING_TASK' | 'WORK_ORDER' | 'ASSET'
  | 'INTEGRATION' | 'CHANNEL_CONFIG'
  | 'EMAIL_PROVIDER' | 'EMAIL_TEMPLATE' | 'EMAIL'
  | 'WHATSAPP_PROVIDER' | 'WHATSAPP_TEMPLATE' | 'WHATSAPP_MESSAGE'
  | 'SUPPLIER' | 'INVENTORY_ITEM' | 'PURCHASE_ORDER' | 'GOODS_RECEIPT'
  | 'EMPLOYEE' | 'PAYROLL_PERIOD' | 'PAYROLL_RUN'
  | 'REVENUE_KPI' | 'PRICING_RECOMMENDATION'
  | 'CRM_PROFILE' | 'LOYALTY_MEMBERSHIP'
  | 'EVENT_BOOKING' | 'EVENT_VENUE'
  | 'FNB_ORDER' | 'SPA_APPOINTMENT';

// Re-export IAM types for convenience
export type { AuditOutcome, SecurityAuditLogDto } from '../iam/iam.contract';

// ==========================================
// AUDIT LOG (Immutable)
// ==========================================

export interface AuditLogDto {
  id: string;
  timestamp: string;
  actorId: string | null;
  actorType: 'USER' | 'SYSTEM' | 'WEBHOOK' | 'SCHEDULED_JOB';
  action: AuditAction;
  outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  entityType: AuditLogEntityType | null;
  entityId: string | null;
  propertyId: string | null;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  source: 'API' | 'WEBHOOK' | 'SCHEDULED_JOB' | 'MANUAL';
  correlationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, any>;
}

export interface AuditLogQueryDto {
  actorId?: string;
  actorType?: 'USER' | 'SYSTEM' | 'WEBHOOK' | 'SCHEDULED_JOB';
  action?: AuditAction;
  outcome?: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  entityType?: AuditLogEntityType;
  entityId?: string;
  propertyId?: string;
  startDate?: string;
  endDate?: string;
  correlationId?: string;
  ipAddress?: string;
  page?: number;
  limit?: number;
  sortBy?: 'timestamp';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditLogSummaryDto {
  totalRecords: number;
  byAction: Record<AuditAction, number>;
  byOutcome: Record<'SUCCESS' | 'FAILURE' | 'PARTIAL', number>;
  byEntityType: Record<string, number>;
  byActor: Array<{ actorId: string; count: number }>;
  periodStart: string;
  periodEnd: string;
}

// ==========================================
// ACTIVITY CENTER (Aggregated view for UI)
// ==========================================

export interface ActivityEventDto {
  id: string;
  timestamp: string;
  actor: {
    id: string;
    name: string;
    type: 'USER' | 'SYSTEM' | 'WEBHOOK' | 'SCHEDULED_JOB';
  };
  action: AuditAction;
  outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  entity: {
    type: AuditLogEntityType | null;
    id: string | null;
    name: string | null;
  };
  property: {
    id: string | null;
    name: string | null;
  };
  summary: string;
  correlationId: string | null;
}

export interface ActivityCenterQueryDto {
  actorId?: string;
  action?: AuditAction;
  outcome?: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  entityType?: AuditLogEntityType;
  entityId?: string;
  propertyId?: string;
  startDate?: string;
  endDate?: string;
  correlationId?: string;
  page?: number;
  limit?: number;
}