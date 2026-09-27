import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../common/database/prisma.service';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';
import {
  WhatsAppProviderConfigDto,
  WhatsAppTemplateDto,
  WhatsAppMessageDto,
  WhatsAppWebhookDto,
  WhatsAppStatsDto,
  WhatsAppProviderType,
  WhatsAppStatus,
  WhatsAppTemplateType,
  WhatsAppProvider,
} from '@hms/api-contracts';
import {
  CreateWhatsAppProviderConfigDto,
  UpdateWhatsAppProviderConfigDto,
  CreateWhatsAppTemplateDto,
  UpdateWhatsAppTemplateDto,
  SendWhatsAppMessageDto,
  SendTemplatedWhatsAppDto,
} from '../dto/whatsapp.dto';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly providers = new Map<WhatsAppProviderType, WhatsAppProvider>();

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // PROVIDER REGISTRY
  // ============================================================================

  registerProvider(provider: WhatsAppProvider): void {
    this.providers.set(provider.provider, provider);
    this.logger.log(`Registered WhatsApp provider: ${provider.provider}`);
  }

  getProvider(type: WhatsAppProviderType): WhatsAppProvider | undefined {
    return this.providers.get(type);
  }

  // ============================================================================
  // WHATSAPP PROVIDER CONFIGURATION CRUD
  // ============================================================================

  async findProviderConfigs(propertyId: string, enabledOnly?: boolean): Promise<WhatsAppProviderConfigDto[]> {
    const where: Prisma.WhatsAppProviderConfigWhereInput = {
      propertyId,
      deletedAt: null,
      ...(enabledOnly !== undefined ? { enabled: enabledOnly } : {}),
    };

    const configs = await this.prisma.whatsAppProviderConfig.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return configs.map(this.mapProviderConfig);
  }

  async findProviderConfigById(propertyId: string, id: string): Promise<WhatsAppProviderConfigDto> {
    const config = await this.prisma.whatsAppProviderConfig.findFirst({
      where: { id, propertyId, deletedAt: null },
    });

    if (!config) {
      throw new NotFoundException(`WhatsApp provider config '${id}' not found for property`);
    }

    return this.mapProviderConfig(config);
  }

  async createProviderConfig(
    propertyId: string,
    dto: CreateWhatsAppProviderConfigDto,
    actorId?: string,
  ): Promise<WhatsAppProviderConfigDto> {
    const provider = this.getProvider(dto.provider);
    if (!provider) {
      throw new BadRequestException(`No provider registered for '${dto.provider}'`);
    }

    // Validate configuration
    try {
      await provider.configure(dto.configuration);
      const health = await provider.healthCheck();
      if (!health.healthy) {
        throw new BadRequestException(`Provider health check failed: ${JSON.stringify(health.details)}`);
      }
    } catch (error: any) {
      throw new BadRequestException(`Configuration validation failed: ${error.message}`);
    }

    const config = await this.prisma.whatsAppProviderConfig.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        provider: dto.provider,
        name: dto.name,
        enabled: true,
        configuration: dto.configuration,
        phoneNumberId: dto.phoneNumberId,
        businessAccountId: dto.businessAccountId,
        version: 0,
      },
    });

    const event = createCloudEvent({
      type: 'whatsapp.provider.created',
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/notifications/whatsapp/providers/${config.id}`,
      subject: config.id,
      propertyId,
      data: {
        propertyId,
        providerConfigId: config.id,
        provider: dto.provider,
        name: dto.name,
        phoneNumberId: dto.phoneNumberId,
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
        correlationId: `whatsapp_provider_created_${config.id}`,
      },
    });

    return this.mapProviderConfig(config);
  }

  async updateProviderConfig(
    propertyId: string,
    id: string,
    dto: UpdateWhatsAppProviderConfigDto,
  ): Promise<WhatsAppProviderConfigDto> {
    await this.findProviderConfigById(propertyId, id);

    const config = await this.prisma.whatsAppProviderConfig.findFirst({ where: { id, propertyId, deletedAt: null } });
    if (!config) throw new NotFoundException('Config not found');

    const provider = this.getProvider(config.provider);
    if (!provider) throw new BadRequestException(`Provider '${config.provider}' not registered`);

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

    const updated = await this.prisma.whatsAppProviderConfig.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.configuration !== undefined && { configuration: dto.configuration }),
        ...(dto.phoneNumberId !== undefined && { phoneNumberId: dto.phoneNumberId }),
        ...(dto.businessAccountId !== undefined && { businessAccountId: dto.businessAccountId }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        version: { increment: 1 },
      },
    });

    return this.mapProviderConfig(updated);
  }

  async deleteProviderConfig(propertyId: string, id: string): Promise<void> {
    await this.findProviderConfigById(propertyId, id);
    await this.prisma.whatsAppProviderConfig.update({
      where: { id },
      data: { deletedAt: new Date(), enabled: false },
    });
  }

  // ============================================================================
  // WHATSAPP TEMPLATES
  // ============================================================================

  async findTemplates(propertyId: string, type?: WhatsAppTemplateType, activeOnly?: boolean): Promise<WhatsAppTemplateDto[]> {
    const where: Prisma.WhatsAppTemplateWhereInput = {
      propertyId,
      deletedAt: null,
      ...(type ? { type } : {}),
      ...(activeOnly !== undefined ? { isActive: activeOnly } : {}),
    };

    const templates = await this.prisma.whatsAppTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return templates.map(this.mapTemplate);
  }

  async findTemplateById(propertyId: string, id: string): Promise<WhatsAppTemplateDto> {
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: { id, propertyId, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundException(`WhatsApp template '${id}' not found for property`);
    }

    return this.mapTemplate(template);
  }

  async createTemplate(
    propertyId: string,
    dto: CreateWhatsAppTemplateDto,
  ): Promise<WhatsAppTemplateDto> {
    const template = await this.prisma.whatsAppTemplate.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        whatsAppProviderConfigId: dto.whatsAppProviderConfigId,
        type: dto.type,
        name: dto.name,
        language: dto.language,
        category: dto.category,
        headerText: dto.headerText,
        bodyText: dto.bodyText,
        footerText: dto.footerText,
        buttons: dto.buttons || [],
        variables: dto.variables || [],
        isActive: true,
      },
    });

    return this.mapTemplate(template);
  }

  async updateTemplate(
    propertyId: string,
    id: string,
    dto: UpdateWhatsAppTemplateDto,
  ): Promise<WhatsAppTemplateDto> {
    await this.findTemplateById(propertyId, id);

    const updated = await this.prisma.whatsAppTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.headerText !== undefined && { headerText: dto.headerText }),
        ...(dto.bodyText !== undefined && { bodyText: dto.bodyText }),
        ...(dto.footerText !== undefined && { footerText: dto.footerText }),
        ...(dto.buttons !== undefined && { buttons: dto.buttons }),
        ...(dto.variables !== undefined && { variables: dto.variables }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return this.mapTemplate(updated);
  }

  async deleteTemplate(propertyId: string, id: string): Promise<void> {
    await this.findTemplateById(propertyId, id);
    await this.prisma.whatsAppTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ============================================================================
  // SEND WHATSAPP MESSAGE
  // ============================================================================

  async sendMessage(propertyId: string, dto: SendWhatsAppMessageDto): Promise<WhatsAppMessageDto> {
    const config = await this.findProviderConfigById(propertyId, dto.whatsAppProviderConfigId);

    if (!config.enabled) {
      throw new BadRequestException('WhatsApp provider is disabled');
    }

    const provider = this.getProvider(config.provider);
    if (!provider) {
      throw new BadRequestException(`Provider '${config.provider}' not registered`);
    }

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.whatsAppMessage.findFirst({
        where: { idempotencyKey: dto.idempotencyKey, propertyId },
      });
      if (existing) {
        this.logger.warn(`Idempotent replay detected for WhatsApp Message: ${dto.idempotencyKey}`);
        return this.mapMessage(existing);
      }
    }

    // Prepare content based on type
    let templateName = dto.templateName;
    let language = dto.language;
    let templateVariables = dto.templateVariables;
    let textContent = dto.textContent;
    let mediaUrl = dto.mediaUrl;

    if (dto.templateId) {
      const template = await this.findTemplateById(propertyId, dto.templateId);
      templateName = templateName || template.name;
      language = language || template.language;
      templateVariables = templateVariables || {};
    }

    if (dto.type === 'TEMPLATE' && !templateName) {
      throw new BadRequestException('Template name is required for template messages');
    }

    if (dto.type === 'TEXT' && !textContent) {
      throw new BadRequestException('Text content is required for text messages');
    }

    if (['IMAGE', 'DOCUMENT'].includes(dto.type) && !mediaUrl) {
      throw new BadRequestException('Media URL is required for image/document messages');
    }

    // Send via provider
    const result = await provider.sendMessage({
      whatsAppProviderConfigId: dto.whatsAppProviderConfigId,
      templateId: dto.templateId,
      to: dto.to,
      type: dto.type,
      templateName,
      language,
      templateVariables,
      textContent,
      mediaUrl,
      priority: dto.priority,
      scheduledAt: dto.scheduledAt,
    });

    // Create message record
    const message = await this.prisma.whatsAppMessage.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        whatsAppProviderConfigId: dto.whatsAppProviderConfigId,
        templateId: dto.templateId,
        to: dto.to,
        type: dto.type,
        templateName,
        language,
        templateVariables,
        textContent,
        mediaUrl,
        status: result.status as WhatsAppStatus,
        priority: dto.priority || 'NORMAL',
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        sentAt: result.status === 'SENT' ? new Date() : null,
        failedAt: result.status === 'FAILED' ? new Date() : null,
        errorMessage: result.status === 'FAILED' ? 'Provider returned failure' : null,
        retryCount: 0,
        maxRetries: 3,
        idempotencyKey: dto.idempotencyKey || `whatsapp_${generateUuidV7()}`,
        correlationId: dto.correlationId,
        metadata: dto.metadata || {},
        version: 0,
      },
    });

    const event = createCloudEvent({
      type: 'whatsapp.message.sent',
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/notifications/whatsapp/${message.id}`,
      subject: message.id,
      propertyId,
      data: {
        propertyId,
        messageId: message.id,
        externalId: result.externalId,
        to: dto.to,
        type: dto.type,
        status: result.status,
        actorId: dto.metadata?.actorId,
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
        correlationId: dto.idempotencyKey || dto.correlationId || `whatsapp_sent_${message.id}`,
      },
    });

    return this.mapMessage(message);
  }

  async sendTemplatedMessage(propertyId: string, dto: SendTemplatedWhatsAppDto): Promise<WhatsAppMessageDto> {
    const config = await this.findProviderConfigById(propertyId, dto.whatsAppProviderConfigId);

    if (!config.enabled) {
      throw new BadRequestException('WhatsApp provider is disabled');
    }

    const provider = this.getProvider(config.provider);
    if (!provider) {
      throw new BadRequestException(`Provider '${config.provider}' not registered`);
    }

    // Find template by type
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: {
        propertyId,
        type: dto.templateType,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!template) {
      throw new NotFoundException(`No active template found for type '${dto.templateType}'`);
    }

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.whatsAppMessage.findFirst({
        where: { idempotencyKey: dto.idempotencyKey, propertyId },
      });
      if (existing) {
        this.logger.warn(`Idempotent replay detected for Templated WhatsApp: ${dto.idempotencyKey}`);
        return this.mapMessage(existing);
      }
    }

    // Send via provider
    const result = await provider.sendTemplatedMessage({
      whatsAppProviderConfigId: dto.whatsAppProviderConfigId,
      templateType: dto.templateType,
      to: dto.to,
      variables: dto.variables,
      language: dto.language,
      priority: dto.priority,
      scheduledAt: dto.scheduledAt,
    });

    // Create message record
    const message = await this.prisma.whatsAppMessage.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        whatsAppProviderConfigId: dto.whatsAppProviderConfigId,
        templateId: template.id,
        to: dto.to,
        type: 'TEMPLATE',
        templateName: template.name,
        language: dto.language || template.language,
        templateVariables: dto.variables,
        status: result.status as WhatsAppStatus,
        priority: dto.priority || 'NORMAL',
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        sentAt: result.status === 'SENT' ? new Date() : null,
        failedAt: result.status === 'FAILED' ? new Date() : null,
        errorMessage: result.status === 'FAILED' ? 'Provider returned failure' : null,
        retryCount: 0,
        maxRetries: 3,
        idempotencyKey: dto.idempotencyKey || `whatsapp_${generateUuidV7()}`,
        correlationId: dto.correlationId,
        metadata: dto.metadata || {},
        version: 0,
      },
    });

    const event = createCloudEvent({
      type: 'whatsapp.message.sent',
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/notifications/whatsapp/${message.id}`,
      subject: message.id,
      propertyId,
      data: {
        propertyId,
        messageId: message.id,
        externalId: result.externalId,
        to: dto.to,
        templateType: dto.templateType,
        status: result.status,
        actorId: dto.metadata?.actorId,
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
        correlationId: dto.idempotencyKey || dto.correlationId || `whatsapp_sent_${message.id}`,
      },
    });

    return this.mapMessage(message);
  }

  // ============================================================================
  // MESSAGE LOOKUP
  // ============================================================================

  async findMessages(propertyId: string, status?: WhatsAppStatus, limit = 50): Promise<WhatsAppMessageDto[]> {
    const where: Prisma.WhatsAppMessageWhereInput = {
      propertyId,
      deletedAt: null,
      ...(status ? { status } : {}),
    };

    const messages = await this.prisma.whatsAppMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.map(this.mapMessage);
  }

  async findMessageById(propertyId: string, id: string): Promise<WhatsAppMessageDto> {
    const message = await this.prisma.whatsAppMessage.findFirst({
      where: { id, propertyId, deletedAt: null },
    });

    if (!message) {
      throw new NotFoundException(`WhatsApp message '${id}' not found for property`);
    }

    return this.mapMessage(message);
  }

  // ============================================================================
  // WEBHOOK PROCESSING
  // ============================================================================

  async processWebhook(
    propertyId: string,
    whatsAppProviderConfigId: string,
    payload: Record<string, any>,
    signature?: string,
  ): Promise<WhatsAppWebhookDto> {
    const config = await this.findProviderConfigById(propertyId, whatsAppProviderConfigId);
    const provider = this.getProvider(config.provider);
    if (!provider) {
      throw new BadRequestException(`Provider '${config.provider}' not registered`);
    }

    const webhook = provider.parseWebhook(payload, signature);

    // Verify signature if present
    if (signature && !provider.verifyWebhookSignature(JSON.stringify(payload), signature, config.configuration.webhookSecret)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Idempotency check
    const idempotencyKey = webhook.idempotencyKey;
    const existing = await this.prisma.whatsAppWebhook.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      this.logger.warn(`Idempotent webhook replay detected: ${idempotencyKey}`);
      return this.mapWebhook(existing);
    }

    const webhookRecord = await this.prisma.whatsAppWebhook.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        whatsAppProviderConfigId,
        messageId: webhook.messageId,
        eventType: webhook.eventType,
        payload: webhook.payload,
        processed: true,
        processedAt: new Date(),
        correlationId: webhook.correlationId,
        idempotencyKey,
        version: 0,
      },
    });

    // Update message status based on event type
    if (webhook.messageId) {
      const statusMap: Record<string, WhatsAppStatus> = {
        sent: 'SENT',
        delivered: 'DELIVERED',
        read: 'READ',
        failed: 'FAILED',
      };

      const newStatus = statusMap[webhook.eventType];
      if (newStatus) {
        const updateData: any = { status: newStatus };
        if (newStatus === 'DELIVERED') updateData.deliveredAt = new Date();
        if (newStatus === 'READ') updateData.readAt = new Date();
        if (newStatus === 'FAILED') updateData.failedAt = new Date();

        await this.prisma.whatsAppMessage.update({
          where: { id: webhook.messageId },
          data: updateData,
        });
      }
    }

    return this.mapWebhook(webhookRecord);
  }

  // ============================================================================
  // STATS
  // ============================================================================

  async getStats(propertyId: string, periodStart: string, periodEnd: string): Promise<WhatsAppStatsDto> {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    const messages = await this.prisma.whatsAppMessage.findMany({
      where: {
        propertyId,
        createdAt: { gte: start, lte: end },
        deletedAt: null,
      },
    });

    const totalSent = messages.filter(m => m.status !== 'PENDING').length;
    const totalDelivered = messages.filter(m => m.status === 'DELIVERED').length;
    const totalRead = messages.filter(m => m.status === 'READ').length;
    const totalFailed = messages.filter(m => m.status === 'FAILED').length;

    // Get unique template IDs
    const templateIds = [...new Set(messages.map(m => m.templateId).filter((id): id is string => Boolean(id)))];
    const templates = await this.prisma.whatsAppTemplate.findMany({
      where: { id: { in: templateIds } },
      select: { id: true, type: true },
    });
    const templateTypeMap = new Map(templates.map(t => [t.id, t.type]));

    const byTemplate = messages.reduce((acc: Array<{ templateType: WhatsAppTemplateType; sent: number; delivered: number; read: number; failed: number }>, m: any) => {
      if (m.templateId) {
        const type = templateTypeMap.get(m.templateId);
        if (type) {
          const existing = acc.find((t) => t.templateType === type);
          if (existing) {
            existing.sent++;
            if (m.status === 'DELIVERED') existing.delivered++;
            if (m.status === 'READ') existing.read++;
            if (m.status === 'FAILED') existing.failed++;
          } else {
            acc.push({
              templateType: type,
              sent: 1,
              delivered: m.status === 'DELIVERED' ? 1 : 0,
              read: m.status === 'READ' ? 1 : 0,
              failed: m.status === 'FAILED' ? 1 : 0,
            });
          }
        }
      }
      return acc;
    }, [] as Array<{ templateType: WhatsAppTemplateType; sent: number; delivered: number; read: number; failed: number }>);

    return {
      propertyId,
      periodStart,
      periodEnd,
      totalSent,
      totalDelivered,
      totalRead,
      totalFailed,
      deliveryRate: totalSent > 0 ? totalDelivered / totalSent : 0,
      readRate: totalSent > 0 ? totalRead / totalSent : 0,
      byTemplate,
    };
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapProviderConfig = (c: any): WhatsAppProviderConfigDto => ({
    id: c.id,
    propertyId: c.propertyId,
    provider: c.provider as WhatsAppProviderType,
    name: c.name,
    enabled: c.enabled,
    configuration: c.configuration as Record<string, any>,
    phoneNumberId: c.phoneNumberId,
    businessAccountId: c.businessAccountId,
    lastSyncAt: c.lastSyncAt?.toISOString() || null,
    lastError: c.lastError,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  });

  private mapTemplate = (t: any): WhatsAppTemplateDto => ({
    id: t.id,
    propertyId: t.propertyId,
    whatsAppProviderConfigId: t.whatsAppProviderConfigId,
    type: t.type as WhatsAppTemplateType,
    name: t.name,
    language: t.language,
    category: t.category,
    headerText: t.headerText,
    bodyText: t.bodyText,
    footerText: t.footerText,
    buttons: t.buttons as Array<{ type: 'QUICK_REPLY' | 'URL'; text: string; url?: string }> | undefined,
    variables: t.variables as string[],
    isActive: t.isActive,
    externalTemplateId: t.externalTemplateId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  });

  private mapMessage = (m: any): WhatsAppMessageDto => ({
    id: m.id,
    propertyId: m.propertyId,
    whatsAppProviderConfigId: m.whatsAppProviderConfigId,
    templateId: m.templateId,
    to: m.to,
    type: m.type,
    templateName: m.templateName,
    language: m.language,
    templateVariables: m.templateVariables as Record<string, any> | undefined,
    textContent: m.textContent,
    mediaUrl: m.mediaUrl,
    status: m.status as WhatsAppStatus,
    priority: m.priority,
    scheduledAt: m.scheduledAt?.toISOString() || null,
    sentAt: m.sentAt?.toISOString() || null,
    deliveredAt: m.deliveredAt?.toISOString() || null,
    readAt: m.readAt?.toISOString() || null,
    failedAt: m.failedAt?.toISOString() || null,
    errorMessage: m.errorMessage,
    retryCount: m.retryCount,
    maxRetries: m.maxRetries,
    idempotencyKey: m.idempotencyKey,
    correlationId: m.correlationId,
    metadata: m.metadata as Record<string, any>,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  });

  private mapWebhook = (w: any): WhatsAppWebhookDto => ({
    id: w.id,
    propertyId: w.propertyId,
    whatsAppProviderConfigId: w.whatsAppProviderConfigId,
    messageId: w.messageId,
    eventType: w.eventType,
    payload: w.payload as Record<string, any>,
    processed: w.processed,
    processedAt: w.processedAt?.toISOString() || null,
    correlationId: w.correlationId,
    idempotencyKey: w.idempotencyKey,
    createdAt: w.createdAt.toISOString(),
  });
}