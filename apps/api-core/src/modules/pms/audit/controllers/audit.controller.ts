import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ScopedRbacGuard } from '../../../identity/presentation/guards/scoped-rbac.guard';
import { RequirePermissions } from '../../../identity/presentation/decorators/authz.decorators';
import { AuditService } from '../services/audit.service';
import {
  AuditLogDto,
  AuditLogSummaryDto,
  SecurityAuditLogDto,
  ActivityEventDto,
  AuditAction,
  AuditLogEntityType,
} from '@hms/api-contracts';
import type { AuditOutcome } from '@hms/api-contracts';
import { AuditLogQueryDto, ActivityCenterQueryDto } from '../dto/audit.dto';

@ApiTags('PMS - Audit / Activity Center')
@ApiBearerAuth()
@Controller('properties/:propertyId/audit')
@UseGuards(ScopedRbacGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // ============================================================================
  // AUDIT LOG QUERIES
  // ============================================================================

  @Get()
  @RequirePermissions('audit_log:read')
  @ApiOperation({ summary: 'List audit logs for a property' })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'actorType', enum: ['USER', 'SYSTEM', 'WEBHOOK', 'SCHEDULED_JOB'], required: false })
  @ApiQuery({ name: 'action', enum: ['LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'CREATE', 'READ', 'UPDATE', 'DELETE', 'CHECK_IN', 'CHECKOUT', 'CANCEL', 'ASSIGN_ROOM', 'UNASSIGN_ROOM', 'POST_CHARGE', 'RECORD_PAYMENT', 'REFUND', 'CHANGE_ROOM_STATUS', 'HOUSEKEEPING_TASK', 'CREATE_WORK_ORDER', 'UPDATE_WORK_ORDER', 'CREATE_RESERVATION', 'UPDATE_RESERVATION', 'CONFIGURE_INTEGRATION', 'SYNC_INTEGRATION', 'PROCESS_PAYMENT', 'AUTHORIZE_PAYMENT', 'CAPTURE_PAYMENT', 'REFUND_PAYMENT', 'SEND_EMAIL', 'SEND_WHATSAPP', 'RUN_NIGHT_AUDIT', 'VALIDATE_NIGHT_AUDIT', 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'ASSIGN_ROLE', 'REVOKE_ROLE', 'EXPORT_DATA', 'IMPORT_DATA'], required: false })
  @ApiQuery({ name: 'outcome', enum: ['SUCCESS', 'FAILURE', 'PARTIAL'], required: false })
  @ApiQuery({ name: 'entityType', enum: ['USER', 'ROLE', 'PERMISSION', 'PROPERTY', 'ROOM', 'ROOM_TYPE', 'RATE_PLAN', 'RESERVATION', 'GUEST', 'FOLIO', 'PAYMENT', 'HOUSEKEEPING_TASK', 'WORK_ORDER', 'ASSET', 'INTEGRATION', 'CHANNEL_CONFIG', 'EMAIL_PROVIDER', 'EMAIL_TEMPLATE', 'EMAIL', 'WHATSAPP_PROVIDER', 'WHATSAPP_TEMPLATE', 'WHATSAPP_MESSAGE', 'SUPPLIER', 'INVENTORY_ITEM', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'EMPLOYEE', 'PAYROLL_PERIOD', 'PAYROLL_RUN', 'REVENUE_KPI', 'PRICING_RECOMMENDATION', 'CRM_PROFILE', 'LOYALTY_MEMBERSHIP', 'EVENT_BOOKING', 'EVENT_VENUE', 'FNB_ORDER', 'SPA_APPOINTMENT'], required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'correlationId', required: false })
  @ApiQuery({ name: 'ipAddress', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', enum: ['timestamp'], required: false })
  @ApiQuery({ name: 'sortOrder', enum: ['asc', 'desc'], required: false })
  async findAuditLogs(
    @Param('propertyId') propertyId: string,
    @Query() query: any,
  ): Promise<any[]> {
    return this.auditService.findAuditLogs(propertyId, query);
  }

  @Get('summary')
  @RequirePermissions('audit_log:read')
  @ApiOperation({ summary: 'Get audit log summary statistics' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'outcome', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  async getAuditLogSummary(
    @Param('propertyId') propertyId: string,
    @Query() query: any,
  ): Promise<any> {
    return this.auditService.getAuditLogSummary(propertyId, query);
  }

  @Get(':id')
  @RequirePermissions('audit_log:read')
  @ApiOperation({ summary: 'Get audit log by ID' })
  async findAuditLogById(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<any> {
    return this.auditService.findAuditLogById(propertyId, id);
  }

  // ============================================================================
  // SECURITY AUDIT LOG
  // ============================================================================

  @Get('security')
  @RequirePermissions('audit_log:read')
  @ApiOperation({ summary: 'List security audit logs' })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'correlationId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findSecurityAuditLogs(
    @Param('propertyId') propertyId: string,
    @Query() query: any,
  ): Promise<any[]> {
    return this.auditService.findSecurityAuditLogs(query);
  }

  // ============================================================================
  // ACTIVITY CENTER (Aggregated view for UI)
  // ============================================================================

  @Get('activity')
  @RequirePermissions('audit_log:read')
  @ApiOperation({ summary: 'Get aggregated activity events for Activity Center UI' })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'outcome', enum: ['SUCCESS', 'FAILURE', 'PARTIAL'], required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'correlationId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findActivityEvents(
    @Param('propertyId') propertyId: string,
    @Query() query: any,
  ): Promise<any[]> {
    return this.auditService.findActivityEvents(propertyId, query);
  }
}