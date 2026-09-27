import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';
import {
  ChannelConfigDto,
  ChannelSyncLogDto,
  OtaReservationDto,
  ChannelProvider,
  ChannelSyncType,
  ChannelSyncStatus,
  OtaReservationStatus,
  ReconciliationReportDto,
  ChannelAdapter,
} from '@hms/api-contracts';
import {
  CreateChannelConfigDto,
  UpdateChannelConfigDto,
  ChannelSyncLogQueryDto,
  GenerateReconciliationDto,
  SimulateInboundReservationDto,
} from '../dto/channel-manager.dto';

@Injectable()
export class ChannelManagerService {
  private readonly logger = new Logger(ChannelManagerService.name);
  private readonly adapters = new Map<ChannelProvider, ChannelAdapter>();

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // ADAPTER REGISTRY
  // ============================================================================

  registerAdapter(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.provider, adapter);
    this.logger.log(`Registered channel adapter: ${adapter.provider}`);
  }

  getAdapter(provider: ChannelProvider): ChannelAdapter | undefined {
    return this.adapters.get(provider);
  }

  getAllAdapters(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }

  // ============================================================================
  // CHANNEL CONFIGURATION CRUD
  // ============================================================================

  async findChannelConfigs(propertyId: string, enabledOnly?: boolean): Promise<ChannelConfigDto[]> {
    const where: Prisma.ChannelConfigWhereInput = {
      propertyId,
      deletedAt: null,
      ...(enabledOnly !== undefined ? { enabled: enabledOnly } : {}),
    };

    const configs = await this.prisma.channelConfig.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return configs.map(this.mapChannelConfig);
  }

  async findChannelConfigById(propertyId: string, id: string): Promise<ChannelConfigDto> {
    const config = await this.prisma.channelConfig.findFirst({
      where: { id, propertyId, deletedAt: null },
    });

    if (!config) {
      throw new NotFoundException(`Channel configuration '${id}' not found for property`);
    }

    return this.mapChannelConfig(config);
  }

  async createChannelConfig(
    propertyId: string,
    dto: CreateChannelConfigDto,
    actorId?: string,
  ): Promise<ChannelConfigDto> {
    // Validate adapter exists
    const adapter = this.getAdapter(dto.provider);
    if (!adapter) {
      throw new BadRequestException(`No adapter registered for provider '${dto.provider}'`);
    }

    const config = await this.prisma.channelConfig.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        provider: dto.provider,
        name: dto.name,
        enabled: true,
        configuration: dto.configuration,
        fieldMapping: dto.fieldMapping || {},
        version: 0,
      },
    });

    // Create outbox event
    const event = createCloudEvent({
      type: 'channel.config.created',
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/channels/${config.id}`,
      subject: config.id,
      propertyId,
      data: {
        propertyId,
        channelConfigId: config.id,
        provider: dto.provider,
        name: dto.name,
        actorId,
      },
    });

    await this.prisma.outboxEvent.create({
      data: {
        id: event.id,
        specversion: event.specversion,
        type: event.type,
        source: event.source,
        subject: event.subject,
        propertyId,
        datacontenttype: event.datacontenttype,
        time: new Date(event.time),
        data: event.data as any,
        correlationId: `channel_config_created_${config.id}`,
      },
    });

    return this.mapChannelConfig(config);
  }

  async updateChannelConfig(
    propertyId: string,
    id: string,
    dto: UpdateChannelConfigDto,
  ): Promise<ChannelConfigDto> {
    await this.findChannelConfigById(propertyId, id);

    const updated = await this.prisma.channelConfig.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.configuration !== undefined && { configuration: dto.configuration }),
        ...(dto.fieldMapping !== undefined && { fieldMapping: dto.fieldMapping }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        version: { increment: 1 },
      },
    });

    return this.mapChannelConfig(updated);
  }

  async deleteChannelConfig(propertyId: string, id: string): Promise<void> {
    await this.findChannelConfigById(propertyId, id);

    await this.prisma.channelConfig.update({
      where: { id },
      data: { deletedAt: new Date(), enabled: false },
    });
  }

  // ============================================================================
  // INBOUND RESERVATION PROCESSING (OTA → PMS)
  // ============================================================================

  async processInboundReservation(
    propertyId: string,
    channelConfigId: string,
    dto: SimulateInboundReservationDto,
    actorId?: string,
  ): Promise<{ reservationId: string; isNew: boolean; pmsReservationId?: string }> {
    const channelConfig = await this.findChannelConfigById(propertyId, channelConfigId);

    if (!channelConfig.enabled) {
      throw new BadRequestException('Channel is disabled');
    }

    const adapter = this.getAdapter(channelConfig.provider);
    if (!adapter) {
      throw new BadRequestException(`No adapter for provider '${channelConfig.provider}'`);
    }

    // Normalize the inbound data
    const normalized = adapter.normalizeInbound(dto.payload);

    // Idempotency key based on external ID + provider
    const idempotencyKey = `ota_${channelConfig.provider}_${normalized.externalId}`;

    // Check if already processed
    const existingSync = await this.prisma.channelSyncLog.findFirst({
      where: {
        correlationId: idempotencyKey,
        propertyId,
      },
    });

    if (existingSync) {
      this.logger.warn(`Idempotent replay detected for OTA reservation: ${idempotencyKey}`);
      // Return existing reservation info
      return {
        reservationId: normalized.externalId,
        isNew: false,
        pmsReservationId: existingSync.correlationId?.replace(`ota_${channelConfig.provider}_`, ''),
      };
    }

    const syncLogId = generateUuidV7();
    const startedAt = new Date();

    try {
      // Create sync log entry
      await this.prisma.channelSyncLog.create({
        data: {
          id: syncLogId,
          channelConfigId,
          propertyId,
          syncType: 'RESERVATION_INBOUND',
          status: 'SUCCESS',
          correlationId: idempotencyKey,
          startedAt,
        },
      });

      // Here we would call the ReservationService to create/update the PMS reservation
      // For demo, we just simulate the creation
      const pmsReservationId = `pms_${generateUuidV7().slice(0, 8)}`;

      // Update sync log with results
      const completedAt = new Date();
      await this.prisma.channelSyncLog.update({
        where: { id: syncLogId },
        data: {
          status: 'SUCCESS',
          recordsProcessed: 1,
          recordsFailed: 0,
          completedAt,
        },
      });

      // Update channel config last sync
      await this.prisma.channelConfig.update({
        where: { id: channelConfigId },
        data: { lastSyncAt: completedAt, lastError: null },
      });

      // Create outbox event
      const event = createCloudEvent({
        type: 'channel.reservation.inbound',
        source: `https://pms.enterprise-hms.com/properties/${propertyId}/channels/${channelConfigId}/reservations`,
        subject: normalized.externalId,
        propertyId,
        data: {
          propertyId,
          channelConfigId,
          provider: channelConfig.provider,
          externalId: normalized.externalId,
          pmsReservationId,
          status: normalized.status,
          arrivalDate: normalized.arrivalDate,
          departureDate: normalized.departureDate,
          actorId,
        },
      });

      await this.prisma.outboxEvent.create({
        data: {
          id: event.id,
          specversion: event.specversion,
          type: event.type,
          source: event.source,
          subject: event.subject,
          propertyId,
          datacontenttype: event.datacontenttype,
          time: new Date(event.time),
          data: event.data as any,
          correlationId: idempotencyKey,
        },
      });

      return {
        reservationId: normalized.externalId,
        isNew: true,
        pmsReservationId,
      };
    } catch (error: any) {
      const completedAt = new Date();
      await this.prisma.channelSyncLog.update({
        where: { id: syncLogId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          completedAt,
        },
      });

      await this.prisma.channelConfig.update({
        where: { id: channelConfigId },
        data: { lastError: error.message, lastSyncAt: completedAt },
      });

      throw error;
    }
  }

  // ============================================================================
  // OUTBOUND AVAILABILITY / RATE SYNC (PMS → OTA)
  // ============================================================================

  async syncAvailabilityRates(
    propertyId: string,
    channelConfigId: string,
    availability: any[],
    rates: any[],
    actorId?: string,
  ): Promise<{ processed: number; failed: number }> {
    const channelConfig = await this.findChannelConfigById(propertyId, channelConfigId);

    if (!channelConfig.enabled) {
      throw new BadRequestException('Channel is disabled');
    }

    const adapter = this.getAdapter(channelConfig.provider);
    if (!adapter) {
      throw new BadRequestException(`No adapter for provider '${channelConfig.provider}'`);
    }

    const syncLogId = generateUuidV7();
    const startedAt = new Date();
    const correlationId = `sync_${channelConfig.provider}_${Date.now()}`;

    await this.prisma.channelSyncLog.create({
      data: {
        id: syncLogId,
        channelConfigId,
        propertyId,
        syncType: 'AVAILABILITY',
        status: 'SUCCESS',
        correlationId,
        startedAt,
      },
    });

    try {
      // Build payloads using adapter
      const availPayload = adapter.buildAvailabilityPayload(availability);
      const ratePayload = adapter.buildRatePayload(rates);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 100));

      const completedAt = new Date();
      await this.prisma.channelSyncLog.update({
        where: { id: syncLogId },
        data: {
          status: 'SUCCESS',
          recordsProcessed: availability.length + rates.length,
          recordsFailed: 0,
          completedAt,
        },
      });

      await this.prisma.channelConfig.update({
        where: { id: channelConfigId },
        data: { lastSyncAt: completedAt, lastError: null },
      });

      return { processed: availability.length + rates.length, failed: 0 };
    } catch (error: any) {
      const completedAt = new Date();
      await this.prisma.channelSyncLog.update({
        where: { id: syncLogId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          completedAt,
        },
      });

      await this.prisma.channelConfig.update({
        where: { id: channelConfigId },
        data: { lastError: error.message, lastSyncAt: completedAt },
      });

      throw error;
    }
  }

  // ============================================================================
  // SYNC LOGS
  // ============================================================================

  async findSyncLogs(propertyId: string, query: ChannelSyncLogQueryDto): Promise<ChannelSyncLogDto[]> {
    const where: Prisma.ChannelSyncLogWhereInput = {
      propertyId,
      ...(query.channelConfigId ? { channelConfigId: query.channelConfigId } : {}),
      ...(query.syncType ? { syncType: query.syncType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            startedAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const logs = await this.prisma.channelSyncLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: query.limit || 20,
      skip: ((query.page || 1) - 1) * (query.limit || 20),
    });

    return logs.map(this.mapSyncLog);
  }

  // ============================================================================
  // RECONCILIATION
  // ============================================================================

  async generateReconciliation(
    propertyId: string,
    channelConfigId: string,
    dto: GenerateReconciliationDto,
  ): Promise<ReconciliationReportDto> {
    const channelConfig = await this.findChannelConfigById(propertyId, channelConfigId);

    // This is a simplified reconciliation - in production, this would compare
    // PMS reservations with OTA reservations for the given period
    const report: ReconciliationReportDto = {
      propertyId,
      provider: channelConfig.provider,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      totalPmsReservations: 0,
      totalOtaReservations: 0,
      matched: 0,
      pmsOnly: 0,
      otaOnly: 0,
      discrepancies: [],
      generatedAt: new Date().toISOString(),
    };

    // Create sync log for reconciliation
    const syncLogId = generateUuidV7();
    await this.prisma.channelSyncLog.create({
      data: {
        id: syncLogId,
        channelConfigId,
        propertyId,
        syncType: 'RECONCILIATION',
        status: 'SUCCESS',
        recordsProcessed: 1,
        recordsFailed: 0,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    return report;
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapChannelConfig = (c: any): ChannelConfigDto => ({
    id: c.id,
    propertyId: c.propertyId,
    provider: c.provider as ChannelProvider,
    name: c.name,
    enabled: c.enabled,
    configuration: c.configuration as Record<string, any>,
    fieldMapping: c.fieldMapping as Record<string, string>,
    lastSyncAt: c.lastSyncAt?.toISOString() || null,
    lastError: c.lastError,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  });

  private mapSyncLog = (s: any): ChannelSyncLogDto => ({
    id: s.id,
    channelConfigId: s.channelConfigId,
    propertyId: s.propertyId,
    syncType: s.syncType as ChannelSyncType,
    status: s.status as ChannelSyncStatus,
    recordsProcessed: s.recordsProcessed,
    recordsFailed: s.recordsFailed,
    errorMessage: s.errorMessage,
    correlationId: s.correlationId,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt?.toISOString() || null,
  });
}