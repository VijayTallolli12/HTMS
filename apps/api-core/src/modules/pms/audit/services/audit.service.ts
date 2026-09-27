import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';
import {
  AuditLogDto,
  AuditLogSummaryDto,
  SecurityAuditLogDto,
  ActivityEventDto,
  AuditAction,
  AuditLogEntityType,
} from '@hms/api-contracts';
import type { AuditOutcome } from '@hms/api-contracts';
import {
  AuditLogQueryDto,
  ActivityCenterQueryDto,
} from '../dto/audit.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // AUDIT LOG QUERIES
  // ============================================================================

  async findAuditLogs(propertyId: string, query: AuditLogQueryDto): Promise<AuditLogDto[]> {
    const where: Prisma.AuditLogWhereInput = {
      propertyId,
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.actorType ? { actorType: query.actorType } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.outcome ? { outcome: query.outcome as 'SUCCESS' | 'FAILURE' | 'PARTIAL' } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.correlationId ? { correlationId: query.correlationId } : {}),
      ...(query.ipAddress ? { ipAddress: query.ipAddress } : {}),
      ...(query.startDate || query.endDate
        ? {
            timestamp: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const sortOrder = query.sortOrder || 'desc';
    const sortBy = query.sortBy || 'timestamp';

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      take: query.limit || 50,
      skip: ((query.page || 1) - 1) * (query.limit || 50),
    });

    return logs.map(this.mapAuditLog);
  }

  async findAuditLogById(propertyId: string, id: string): Promise<AuditLogDto> {
    const log = await this.prisma.auditLog.findFirst({
      where: { id, propertyId },
    });

    if (!log) {
      throw new NotFoundException(`Audit log '${id}' not found for property`);
    }

    return this.mapAuditLog(log);
  }

  async getAuditLogSummary(propertyId: string, query: AuditLogQueryDto): Promise<AuditLogSummaryDto> {
    const where: Prisma.AuditLogWhereInput = {
      propertyId,
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.actorType ? { actorType: query.actorType } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.outcome ? { outcome: query.outcome as 'SUCCESS' | 'FAILURE' | 'PARTIAL' } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.correlationId ? { correlationId: query.correlationId } : {}),
      ...(query.ipAddress ? { ipAddress: query.ipAddress } : {}),
      ...(query.startDate || query.endDate
        ? {
            timestamp: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const logs = await this.prisma.auditLog.findMany({
      where,
      select: {
        action: true,
        outcome: true,
        entityType: true,
        actorId: true,
      },
    });

    const byAction: Record<AuditAction, number> = {} as Record<AuditAction, number>;
    const byOutcome: Record<'SUCCESS' | 'FAILURE' | 'PARTIAL', number> = {} as Record<'SUCCESS' | 'FAILURE' | 'PARTIAL', number>;
    const byEntityType: Record<string, number> = {};
    const byActor: Record<string, number> = {};

    for (const log of logs) {
      byAction[log.action as AuditAction] = (byAction[log.action as AuditAction] || 0) + 1;
      byOutcome[log.outcome as 'SUCCESS' | 'FAILURE' | 'PARTIAL'] = (byOutcome[log.outcome as 'SUCCESS' | 'FAILURE' | 'PARTIAL'] || 0) + 1;
      if (log.entityType) {
        byEntityType[log.entityType] = (byEntityType[log.entityType] || 0) + 1;
      }
      if (log.actorId) {
        byActor[log.actorId] = (byActor[log.actorId] || 0) + 1;
      }
    }

    const byActorArray = Object.entries(byActor)
      .map(([actorId, count]) => ({ actorId, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalRecords: logs.length,
      byAction,
      byOutcome,
      byEntityType,
      byActor: byActorArray,
      periodStart: query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      periodEnd: query.endDate || new Date().toISOString(),
    };
  }

  // ============================================================================
  // SECURITY AUDIT LOG QUERIES
  // ============================================================================

  async findSecurityAuditLogs(query: {
    actorId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    correlationId?: string;
    page?: number;
    limit?: number;
  }): Promise<SecurityAuditLogDto[]> {
    const where: Prisma.SecurityAuditLogWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.correlationId ? { correlationId: query.correlationId } : {}),
      ...(query.startDate || query.endDate
        ? {
            timestamp: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const logs = await this.prisma.securityAuditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: query.limit || 50,
      skip: ((query.page || 1) - 1) * (query.limit || 50),
    });

    return logs.map(this.mapSecurityAuditLog);
  }

  // ============================================================================
  // ACTIVITY CENTER (Aggregated view for UI)
  // ============================================================================

  async findActivityEvents(propertyId: string, query: ActivityCenterQueryDto): Promise<ActivityEventDto[]> {
    const where: Prisma.AuditLogWhereInput = {
      propertyId,
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.outcome ? { outcome: query.outcome as 'SUCCESS' | 'FAILURE' | 'PARTIAL' } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.correlationId ? { correlationId: query.correlationId } : {}),
      ...(query.startDate || query.endDate
        ? {
            timestamp: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: query.limit || 50,
      skip: ((query.page || 1) - 1) * (query.limit || 50),
    });

    // Enrich with entity names where possible
    return await this.enrichActivityEvents(logs);
  }

  private async enrichActivityEvents(logs: any[]): Promise<ActivityEventDto[]> {
    // Collect unique entity IDs for batch lookups
    const entityLookups = new Map<string, { type: string; id: string }>();
    
    for (const log of logs) {
      if (log.entityType && log.entityId) {
        entityLookups.set(`${log.entityType}:${log.entityId}`, {
          type: log.entityType,
          id: log.entityId,
        });
      }
    }

    // For demo, we'll just return basic info without full enrichment
    // In production, this would batch fetch entity names from respective services
    return logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp.toISOString(),
      actor: {
        id: log.actorId || 'system',
        name: log.actorId || 'System',
        type: log.actorType as 'USER' | 'SYSTEM' | 'WEBHOOK' | 'SCHEDULED_JOB',
      },
      action: log.action as AuditAction,
      outcome: log.outcome as 'SUCCESS' | 'FAILURE' | 'PARTIAL',
      entity: {
        type: log.entityType as AuditLogEntityType | null,
        id: log.entityId,
        name: log.entityId || null,
      },
      property: {
        id: log.propertyId,
        name: log.propertyId || null,
      },
      summary: this.generateSummary(log),
      correlationId: log.correlationId,
    }));
  }

  private generateSummary(log: any): string {
    const action = log.action.toLowerCase().replace(/_/g, ' ');
    const entity = log.entityType ? `${log.entityType.toLowerCase()} ${log.entityId || ''}` : '';
    const outcome = log.outcome.toLowerCase();
    return `${action} ${entity} - ${outcome}`.trim();
  }

  // ============================================================================
  // AUDIT LOG CREATION (Internal use by other services)
  // ============================================================================

  async createAuditLog(data: {
    actorId?: string;
    actorType?: 'USER' | 'SYSTEM' | 'WEBHOOK' | 'SCHEDULED_JOB';
    action: AuditAction;
    outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
    entityType?: AuditLogEntityType;
    entityId?: string;
    propertyId?: string;
    before?: Record<string, any>;
    after?: Record<string, any>;
    source?: 'API' | 'WEBHOOK' | 'SCHEDULED_JOB' | 'MANUAL';
    correlationId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<AuditLogDto> {
    const log = await this.prisma.auditLog.create({
      data: {
        id: generateUuidV7(),
        actorId: data.actorId,
        actorType: data.actorType || 'USER',
        action: data.action,
        outcome: data.outcome,
        entityType: data.entityType,
        entityId: data.entityId,
        propertyId: data.propertyId,
        before: data.before,
        after: data.after,
        source: data.source || 'API',
        correlationId: data.correlationId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata,
        version: 0,
      },
    });

    return this.mapAuditLog(log);
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapAuditLog = (a: any): AuditLogDto => ({
    id: a.id,
    timestamp: a.timestamp.toISOString(),
    actorId: a.actorId,
    actorType: a.actorType as 'USER' | 'SYSTEM' | 'WEBHOOK' | 'SCHEDULED_JOB',
    action: a.action as AuditAction,
    outcome: a.outcome as 'SUCCESS' | 'FAILURE' | 'PARTIAL',
    entityType: a.entityType as AuditLogEntityType | null,
    entityId: a.entityId,
    propertyId: a.propertyId,
    before: a.before as Record<string, any> | null,
    after: a.after as Record<string, any> | null,
    source: a.source as 'API' | 'WEBHOOK' | 'SCHEDULED_JOB' | 'MANUAL',
    correlationId: a.correlationId,
    ipAddress: a.ipAddress,
    userAgent: a.userAgent,
    metadata: a.metadata as Record<string, any>,
  });

  private mapSecurityAuditLog = (s: any): SecurityAuditLogDto => ({
    id: s.id,
    timestamp: s.timestamp.toISOString(),
    actorId: s.actorId,
    actorType: s.actorType,
    action: s.action,
    resourceType: s.resourceType,
    resourceId: s.resourceId,
    outcome: s.outcome,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    correlationId: s.correlationId,
    details: s.details as Record<string, unknown> | null,
  });
}