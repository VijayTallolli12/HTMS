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
  IntegrationDto,
  IntegrationSyncLogDto,
  IntegrationType,
  IntegrationStatus,
  SyncType,
  SyncStatus,
  IntegrationProvider,
} from '@hms/api-contracts';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  UpdateIntegrationStatusDto,
  TestIntegrationConnectionDto,
  IntegrationSyncLogQueryDto,
} from '../dto/integrations.dto';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);
  private readonly providers = new Map<string, IntegrationProvider>();

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // PROVIDER REGISTRY
  // ============================================================================

  registerProvider(provider: IntegrationProvider): void {
    const key = `${provider.type}:${provider.provider}`;
    this.providers.set(key, provider);
    this.logger.log(`Registered integration provider: ${key}`);
  }

  getProvider(type: IntegrationType, provider: string): IntegrationProvider | undefined {
    return this.providers.get(`${type}:${provider}`);
  }

  getProvidersByType(type: IntegrationType): IntegrationProvider[] {
    return Array.from(this.providers.entries())
      .filter(([key]) => key.startsWith(`${type}:`))
      .map(([, provider]) => provider);
  }

  // ============================================================================
  // INTEGRATIONS CRUD
  // ============================================================================

  async findIntegrations(propertyId: string, type?: IntegrationType): Promise<IntegrationDto[]> {
    const where: Prisma.IntegrationWhereInput = {
      propertyId,
      deletedAt: null,
      ...(type ? { type } : {}),
    };

    const integrations = await this.prisma.integration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return integrations.map(this.mapIntegration);
  }

  async findIntegrationById(propertyId: string, id: string): Promise<IntegrationDto> {
    const integration = await this.prisma.integration.findFirst({
      where: { id, propertyId, deletedAt: null },
    });

    if (!integration) {
      throw new NotFoundException(`Integration '${id}' not found for property`);
    }

    return this.mapIntegration(integration);
  }

  async createIntegration(
    propertyId: string,
    dto: CreateIntegrationDto,
    actorId?: string,
  ): Promise<IntegrationDto> {
    // Validate uniqueness: one provider per type per property
    const existing = await this.prisma.integration.findUnique({
      where: {
        uq_integration_property_provider_type: {
          propertyId,
          provider: dto.provider,
          type: dto.type,
        },
      },
    });

    if (existing && !existing.deletedAt) {
      throw new ConflictException(
        `Integration for provider '${dto.provider}' of type '${dto.type}' already exists`,
      );
    }

    // Validate provider exists
    const provider = this.getProvider(dto.type, dto.provider);
    if (!provider) {
      throw new BadRequestException(
        `No provider registered for type '${dto.type}' and provider '${dto.provider}'`,
      );
    }

    // Test configuration
    try {
      await provider.configure(dto.configuration);
      const health = await provider.healthCheck();
      if (!health.healthy) {
        throw new BadRequestException(`Provider health check failed: ${JSON.stringify(health.details)}`);
      }
    } catch (error: any) {
      throw new BadRequestException(`Configuration validation failed: ${error.message}`);
    }

    const integration = await this.prisma.integration.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        provider: dto.provider,
        type: dto.type,
        name: dto.name,
        status: 'ACTIVE',
        enabled: true,
        configuration: dto.configuration,
        version: 0,
      },
    });

    // Create outbox event for integration creation
    const event = createCloudEvent({
      type: 'integration.created',
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/integrations/${integration.id}`,
      subject: integration.id,
      propertyId,
      data: {
        propertyId,
        integrationId: integration.id,
        provider: dto.provider,
        type: dto.type,
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
        correlationId: `integration_created_${integration.id}`,
      },
    });

    return this.mapIntegration(integration);
  }

  async updateIntegration(
    propertyId: string,
    id: string,
    dto: UpdateIntegrationDto,
  ): Promise<IntegrationDto> {
    const integration = await this.findIntegrationById(propertyId, id);

    const provider = this.getProvider(integration.type, integration.provider);
    if (!provider) {
      throw new BadRequestException(
        `Provider '${integration.provider}' not registered for type '${integration.type}'`,
      );
    }

    // If configuration is being updated, validate it
    if (dto.configuration !== undefined) {
      try {
        await provider.configure(dto.configuration);
        const health = await provider.healthCheck();
        if (!health.healthy) {
          throw new BadRequestException(`Provider health check failed: ${JSON.stringify(health.details)}`);
        }
      } catch (error: any) {
        throw new BadRequestException(`Configuration validation failed: ${error.message}`);
      }
    }

    const updated = await this.prisma.integration.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.configuration !== undefined && { configuration: dto.configuration }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        version: { increment: 1 },
      },
    });

    return this.mapIntegration(updated);
  }

  async updateIntegrationStatus(
    propertyId: string,
    id: string,
    dto: UpdateIntegrationStatusDto,
  ): Promise<IntegrationDto> {
    await this.findIntegrationById(propertyId, id);

    const updated = await this.prisma.integration.update({
      where: { id },
      data: {
        status: dto.status,
        version: { increment: 1 },
      },
    });

    return this.mapIntegration(updated);
  }

  async deleteIntegration(propertyId: string, id: string): Promise<void> {
    await this.findIntegrationById(propertyId, id);

    await this.prisma.integration.update({
      where: { id },
      data: { deletedAt: new Date(), enabled: false, status: 'INACTIVE' },
    });
  }

  // ============================================================================
  // CONNECTION TESTING
  // ============================================================================

  async testConnection(dto: TestIntegrationConnectionDto, type: IntegrationType, provider: string): Promise<{ healthy: boolean; details?: any; error?: string }> {
    const integrationProvider = this.getProvider(type, provider);
    if (!integrationProvider) {
      throw new BadRequestException(`Provider '${provider}' not registered for type '${type}'`);
    }

    try {
      await integrationProvider.configure(dto.configuration);
      return await integrationProvider.healthCheck();
    } catch (error: any) {
      return { healthy: false, error: error.message };
    }
  }

  // ============================================================================
  // SYNC OPERATIONS
  // ============================================================================

  async triggerSync(
    propertyId: string,
    integrationId: string,
    syncType: SyncType = 'MANUAL',
    actorId?: string,
  ): Promise<IntegrationSyncLogDto> {
    const integration = await this.findIntegrationById(propertyId, integrationId);

    if (!integration.enabled) {
      throw new BadRequestException('Cannot sync disabled integration');
    }

    const provider = this.getProvider(integration.type, integration.provider);
    if (!provider) {
      throw new BadRequestException(`Provider '${integration.provider}' not registered`);
    }

    const syncLogId = generateUuidV7();
    const startedAt = new Date();

    // Create sync log entry
    const syncLog = await this.prisma.integrationSyncLog.create({
      data: {
        id: syncLogId,
        integrationId,
        propertyId,
        syncType,
        status: 'SUCCESS', // Will be updated after execution
        startedAt,
      },
    });

    try {
      // Execute sync based on integration type
      const result = await this.executeSync(provider, integration);

      const completedAt = new Date();
      await this.prisma.integrationSyncLog.update({
        where: { id: syncLogId },
        data: {
          status: 'SUCCESS',
          recordsProcessed: result.processed,
          recordsFailed: result.failed,
          completedAt,
        },
      });

      // Update integration last sync time
      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { lastSyncAt: completedAt, lastError: null, lastErrorAt: null },
      });

      return this.mapSyncLog(await this.prisma.integrationSyncLog.findUnique({ where: { id: syncLogId } })!);
    } catch (error: any) {
      const completedAt = new Date();
      await this.prisma.integrationSyncLog.update({
        where: { id: syncLogId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          completedAt,
        },
      });

      await this.prisma.integration.update({
        where: { id: integrationId },
        data: {
          status: 'ERROR',
          lastError: error.message,
          lastErrorAt: completedAt,
        },
      });

      throw error;
    }
  }

  private async executeSync(
    provider: IntegrationProvider,
    integration: any,
  ): Promise<{ processed: number; failed: number }> {
    // This is a placeholder - actual sync logic would be implemented per provider
    // For demo purposes, we just simulate a successful sync
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { processed: 0, failed: 0 };
  }

  async findSyncLogs(propertyId: string, query: IntegrationSyncLogQueryDto): Promise<IntegrationSyncLogDto[]> {
    const where: Prisma.IntegrationSyncLogWhereInput = {
      propertyId,
      ...(query.integrationId ? { integrationId: query.integrationId } : {}),
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

    const logs = await this.prisma.integrationSyncLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: query.limit || 20,
      skip: ((query.page || 1) - 1) * (query.limit || 20),
    });

    return logs.map(this.mapSyncLog);
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapIntegration = (i: any): IntegrationDto => ({
    id: i.id,
    propertyId: i.propertyId,
    provider: i.provider,
    type: i.type as IntegrationType,
    name: i.name,
    status: i.status as IntegrationStatus,
    enabled: i.enabled,
    configuration: i.configuration as Record<string, any>,
    lastSyncAt: i.lastSyncAt?.toISOString() || null,
    lastError: i.lastError,
    lastErrorAt: i.lastErrorAt?.toISOString() || null,
    version: i.version,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  });

  private mapSyncLog = (s: any): IntegrationSyncLogDto => ({
    id: s.id,
    integrationId: s.integrationId,
    propertyId: s.propertyId,
    syncType: s.syncType as SyncType,
    status: s.status as SyncStatus,
    recordsProcessed: s.recordsProcessed,
    recordsFailed: s.recordsFailed,
    errorMessage: s.errorMessage,
    correlationId: s.correlationId,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt?.toISOString() || null,
  });
}