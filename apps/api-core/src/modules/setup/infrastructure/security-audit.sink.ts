import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';

export interface SecurityAuditEntry {
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  actorId?: string;
  actorType?: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  details?: Record<string, unknown>;
}

/**
 * Writes to audit_schema.security_audit_logs. The action column is a free
 * string, so W2 setup/demo events (SETUP_ADMIN_CREATED, DEMO_DATA_IMPORTED, …)
 * integrate without schema churn. Never include secrets in details.
 */
@Injectable()
export class SecurityAuditSink {
  private readonly logger = new Logger(SecurityAuditSink.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: SecurityAuditEntry): Promise<void> {
    try {
      await this.prisma.securityAuditLog.create({
        data: {
          id: generateUuidV7(),
          action: entry.action,
          outcome: entry.outcome,
          actorId: entry.actorId ?? null,
          actorType: entry.actorType ?? 'USER',
          resourceType: entry.resourceType ?? null,
          resourceId: entry.resourceId ?? null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
          correlationId: entry.correlationId ?? null,
          details: (entry.details ?? {}) as object,
        },
      });
    } catch (err: any) {
      // Auditing must never break the business operation; surfaced in logs.
      this.logger.error(`Failed to write security audit '${entry.action}': ${err?.message}`);
    }
  }
}
