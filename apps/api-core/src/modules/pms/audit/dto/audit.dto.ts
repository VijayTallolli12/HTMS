import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { AuditAction, AuditLogEntityType } from '@hms/api-contracts';
import type { AuditOutcome } from '@hms/api-contracts';

export class AuditLogQueryDto {
  @ApiPropertyOptional({ description: 'Filter by actor ID' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ enum: ['USER', 'SYSTEM', 'WEBHOOK', 'SCHEDULED_JOB'] })
  @IsOptional()
  @IsIn(['USER', 'SYSTEM', 'WEBHOOK', 'SCHEDULED_JOB'])
  actorType?: 'USER' | 'SYSTEM' | 'WEBHOOK' | 'SCHEDULED_JOB';

  @ApiPropertyOptional({ 
    enum: [
      'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
      'CREATE', 'READ', 'UPDATE', 'DELETE',
      'CHECK_IN', 'CHECKOUT', 'CANCEL',
      'ASSIGN_ROOM', 'UNASSIGN_ROOM',
      'POST_CHARGE', 'RECORD_PAYMENT', 'REFUND',
      'CHANGE_ROOM_STATUS', 'HOUSEKEEPING_TASK',
      'CREATE_WORK_ORDER', 'UPDATE_WORK_ORDER',
      'CREATE_RESERVATION', 'UPDATE_RESERVATION',
      'CONFIGURE_INTEGRATION', 'SYNC_INTEGRATION',
      'PROCESS_PAYMENT', 'AUTHORIZE_PAYMENT', 'CAPTURE_PAYMENT', 'REFUND_PAYMENT',
      'SEND_EMAIL', 'SEND_WHATSAPP',
      'RUN_NIGHT_AUDIT', 'VALIDATE_NIGHT_AUDIT',
      'CREATE_USER', 'UPDATE_USER', 'DELETE_USER',
      'ASSIGN_ROLE', 'REVOKE_ROLE',
      'EXPORT_DATA', 'IMPORT_DATA'
    ] 
  })
  @IsOptional()
  @IsString()
  action?: AuditAction;

  @ApiPropertyOptional({ enum: ['SUCCESS', 'FAILURE', 'PARTIAL'] })
  @IsOptional()
  @IsIn(['SUCCESS', 'FAILURE', 'PARTIAL'])
  outcome?: AuditOutcome;

  @ApiPropertyOptional({ 
    enum: [
      'USER', 'ROLE', 'PERMISSION',
      'PROPERTY', 'ROOM', 'ROOM_TYPE', 'RATE_PLAN',
      'RESERVATION', 'GUEST', 'FOLIO', 'PAYMENT',
      'HOUSEKEEPING_TASK', 'WORK_ORDER', 'ASSET',
      'INTEGRATION', 'CHANNEL_CONFIG',
      'EMAIL_PROVIDER', 'EMAIL_TEMPLATE', 'EMAIL',
      'WHATSAPP_PROVIDER', 'WHATSAPP_TEMPLATE', 'WHATSAPP_MESSAGE',
      'SUPPLIER', 'INVENTORY_ITEM', 'PURCHASE_ORDER', 'GOODS_RECEIPT',
      'EMPLOYEE', 'PAYROLL_PERIOD', 'PAYROLL_RUN',
      'REVENUE_KPI', 'PRICING_RECOMMENDATION',
      'CRM_PROFILE', 'LOYALTY_MEMBERSHIP',
      'EVENT_BOOKING', 'EVENT_VENUE',
      'FNB_ORDER', 'SPA_APPOINTMENT'
    ] 
  })
  @IsOptional()
  @IsString()
  entityType?: AuditLogEntityType;

  @ApiPropertyOptional({ description: 'Filter by entity ID' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Filter by property ID' })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Start date filter (ISO format)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO format)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by correlation ID' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  correlationId?: string;

  @ApiPropertyOptional({ description: 'Filter by IP address' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, description: 'Page size' })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 'timestamp', description: 'Sort field' })
  @IsOptional()
  @IsIn(['timestamp'])
  sortBy?: 'timestamp' = 'timestamp';

  @ApiPropertyOptional({ default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class ActivityCenterQueryDto {
  @ApiPropertyOptional({ description: 'Filter by actor ID' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ 
    enum: [
      'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
      'CREATE', 'READ', 'UPDATE', 'DELETE',
      'CHECK_IN', 'CHECKOUT', 'CANCEL',
      'ASSIGN_ROOM', 'UNASSIGN_ROOM',
      'POST_CHARGE', 'RECORD_PAYMENT', 'REFUND',
      'CHANGE_ROOM_STATUS', 'HOUSEKEEPING_TASK',
      'CREATE_WORK_ORDER', 'UPDATE_WORK_ORDER',
      'CREATE_RESERVATION', 'UPDATE_RESERVATION',
      'CONFIGURE_INTEGRATION', 'SYNC_INTEGRATION',
      'PROCESS_PAYMENT', 'AUTHORIZE_PAYMENT', 'CAPTURE_PAYMENT', 'REFUND_PAYMENT',
      'SEND_EMAIL', 'SEND_WHATSAPP',
      'RUN_NIGHT_AUDIT', 'VALIDATE_NIGHT_AUDIT',
      'CREATE_USER', 'UPDATE_USER', 'DELETE_USER',
      'ASSIGN_ROLE', 'REVOKE_ROLE',
      'EXPORT_DATA', 'IMPORT_DATA'
    ] 
  })
  @IsOptional()
  @IsString()
  action?: AuditAction;

  @ApiPropertyOptional({ enum: ['SUCCESS', 'FAILURE', 'PARTIAL'] })
  @IsOptional()
  @IsIn(['SUCCESS', 'FAILURE', 'PARTIAL'])
  outcome?: AuditOutcome;

  @ApiPropertyOptional({ 
    enum: [
      'USER', 'ROLE', 'PERMISSION',
      'PROPERTY', 'ROOM', 'ROOM_TYPE', 'RATE_PLAN',
      'RESERVATION', 'GUEST', 'FOLIO', 'PAYMENT',
      'HOUSEKEEPING_TASK', 'WORK_ORDER', 'ASSET',
      'INTEGRATION', 'CHANNEL_CONFIG',
      'EMAIL_PROVIDER', 'EMAIL_TEMPLATE', 'EMAIL',
      'WHATSAPP_PROVIDER', 'WHATSAPP_TEMPLATE', 'WHATSAPP_MESSAGE',
      'SUPPLIER', 'INVENTORY_ITEM', 'PURCHASE_ORDER', 'GOODS_RECEIPT',
      'EMPLOYEE', 'PAYROLL_PERIOD', 'PAYROLL_RUN',
      'REVENUE_KPI', 'PRICING_RECOMMENDATION',
      'CRM_PROFILE', 'LOYALTY_MEMBERSHIP',
      'EVENT_BOOKING', 'EVENT_VENUE',
      'FNB_ORDER', 'SPA_APPOINTMENT'
    ] 
  })
  @IsOptional()
  @IsString()
  entityType?: AuditLogEntityType;

  @ApiPropertyOptional({ description: 'Filter by entity ID' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Filter by property ID' })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Start date filter (ISO format)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO format)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by correlation ID' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  correlationId?: string;

  @ApiPropertyOptional({ default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, description: 'Page size' })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 50;
}