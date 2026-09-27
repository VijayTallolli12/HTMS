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
  EmailProviderConfigDto,
  EmailTemplateDto,
  EmailDto,
  EmailWebhookDto,
  EmailStatsDto,
  EmailProviderType,
  EmailStatus,
  EmailTemplateType,
  EmailProvider,
} from '@hms/api-contracts';
import {
  CreateEmailProviderConfigDto,
  UpdateEmailProviderConfigDto,
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  SendEmailDto,
  SendTemplatedEmailDto,
} from '../dto/email.dto';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly providers = new Map<EmailProviderType, EmailProvider>();

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // PROVIDER REGISTRY
  // ============================================================================

  registerProvider(provider: EmailProvider): void {
    this.providers.set(provider.provider, provider);
    this.logger.log(`Registered email provider: ${provider.provider}`);
  }

  getProvider(type: EmailProviderType): EmailProvider | undefined {
    return this.providers.get(type);
  }

  // ============================================================================
  // EMAIL PROVIDER CONFIGURATION CRUD
  // ============================================================================

  async findProviderConfigs(propertyId: string, enabledOnly?: boolean): Promise<EmailProviderConfigDto[]> {
    const where: Prisma.EmailProviderConfigWhereInput = {
      propertyId,
      deletedAt: null,
      ...(enabledOnly !== undefined ? { enabled: enabledOnly } : {}),
    };

    const configs = await this.prisma.emailProviderConfig.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return configs.map(this.mapProviderConfig);
  }

  async findProviderConfigById(propertyId: string, id: string): Promise<EmailProviderConfigDto> {
    const config = await this.prisma.emailProviderConfig.findFirst({
      where: { id, propertyId, deletedAt: null },
    });

    if (!config) {
      throw new NotFoundException(`Email provider config '${id}' not found for property`);
    }

    return this.mapProviderConfig(config);
  }

  async createProviderConfig(
    propertyId: string,
    dto: CreateEmailProviderConfigDto,
    actorId?: string,
  ): Promise<EmailProviderConfigDto> {
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

    const config = await this.prisma.emailProviderConfig.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        provider: dto.provider,
        name: dto.name,
        enabled: true,
        configuration: dto.configuration,
        fromEmail: dto.fromEmail,
        fromName: dto.fromName,
        version: 0,
      },
    });

    const event = createCloudEvent({
      type: 'email.provider.created',
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/notifications/email/providers/${config.id}`,
      subject: config.id,
      propertyId,
      data: {
        propertyId,
        providerConfigId: config.id,
        provider: dto.provider,
        name: dto.name,
        fromEmail: dto.fromEmail,
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
        correlationId: `email_provider_created_${config.id}`,
      },
    });

    return this.mapProviderConfig(config);
  }

  async updateProviderConfig(
    propertyId: string,
    id: string,
    dto: UpdateEmailProviderConfigDto,
  ): Promise<EmailProviderConfigDto> {
    await this.findProviderConfigById(propertyId, id);

    const config = await this.prisma.emailProviderConfig.findFirst({ where: { id, propertyId, deletedAt: null } });
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

    const updated = await this.prisma.emailProviderConfig.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.configuration !== undefined && { configuration: dto.configuration }),
        ...(dto.fromEmail !== undefined && { fromEmail: dto.fromEmail }),
        ...(dto.fromName !== undefined && { fromName: dto.fromName }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        version: { increment: 1 },
      },
    });

    return this.mapProviderConfig(updated);
  }

  async deleteProviderConfig(propertyId: string, id: string): Promise<void> {
    await this.findProviderConfigById(propertyId, id);
    await this.prisma.emailProviderConfig.update({
      where: { id },
      data: { deletedAt: new Date(), enabled: false },
    });
  }

  // ============================================================================
  // EMAIL TEMPLATES
  // ============================================================================

  async findTemplates(propertyId: string, type?: EmailTemplateType, activeOnly?: boolean): Promise<EmailTemplateDto[]> {
    const where: Prisma.EmailTemplateWhereInput = {
      propertyId,
      deletedAt: null,
      ...(type ? { type } : {}),
      ...(activeOnly !== undefined ? { isActive: activeOnly } : {}),
    };

    const templates = await this.prisma.emailTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return templates.map(this.mapTemplate);
  }

  async findTemplateById(propertyId: string, id: string): Promise<EmailTemplateDto> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, propertyId, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundException(`Email template '${id}' not found for property`);
    }

    return this.mapTemplate(template);
  }

  async createTemplate(
    propertyId: string,
    dto: CreateEmailTemplateDto,
    emailProviderConfigId: string,
  ): Promise<EmailTemplateDto> {
    const template = await this.prisma.emailTemplate.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        emailProviderConfigId,
        type: dto.type,
        name: dto.name,
        subject: dto.subject,
        htmlContent: dto.htmlContent,
        textContent: dto.textContent,
        variables: dto.variables || [],
        isActive: true,
      },
    });

    return this.mapTemplate(template);
  }

  async updateTemplate(
    propertyId: string,
    id: string,
    dto: UpdateEmailTemplateDto,
  ): Promise<EmailTemplateDto> {
    await this.findTemplateById(propertyId, id);

    const updated = await this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.htmlContent !== undefined && { htmlContent: dto.htmlContent }),
        ...(dto.textContent !== undefined && { textContent: dto.textContent }),
        ...(dto.variables !== undefined && { variables: dto.variables }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return this.mapTemplate(updated);
  }

  async deleteTemplate(propertyId: string, id: string): Promise<void> {
    await this.findTemplateById(propertyId, id);
    await this.prisma.emailTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ============================================================================
  // SEND EMAIL
  // ============================================================================

  async sendEmail(propertyId: string, dto: SendEmailDto): Promise<EmailDto> {
    const config = await this.findProviderConfigById(propertyId, dto.emailProviderConfigId);

    if (!config.enabled) {
      throw new BadRequestException('Email provider is disabled');
    }

    const provider = this.getProvider(config.provider);
    if (!provider) {
      throw new BadRequestException(`Provider '${config.provider}' not registered`);
    }

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.email.findFirst({
        where: { idempotencyKey: dto.idempotencyKey || `email_${generateUuidV7()}`, propertyId },
      });
      if (existing) {
        this.logger.warn(`Idempotent replay detected for Email: ${dto.idempotencyKey}`);
        return this.mapEmail(existing);
      }
    }

    // Prepare content
    let htmlContent = dto.htmlContent;
    let textContent = dto.textContent;
    let subject = dto.subject;

    if (dto.templateId) {
      const template = await this.findTemplateById(propertyId, dto.templateId);
      subject = subject || template.subject;
      htmlContent = htmlContent || template.htmlContent;
      textContent = textContent || template.textContent;
    }

    if (!subject || !htmlContent || !textContent) {
      throw new BadRequestException('Subject, HTML content, and text content are required');
    }

    // Send via provider
    const result = await provider.sendEmail({
      emailProviderConfigId: dto.emailProviderConfigId,
      templateId: dto.templateId,
      to: dto.to,
      cc: dto.cc,
      bcc: dto.bcc,
      subject,
      htmlContent,
      textContent,
      priority: dto.priority,
      scheduledAt: dto.scheduledAt,
    });

    // Create email record
    const email = await this.prisma.email.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        emailProviderConfigId: dto.emailProviderConfigId,
        templateId: dto.templateId,
        to: dto.to,
        cc: dto.cc,
        bcc: dto.bcc,
        subject,
        htmlContent,
        textContent,
        status: result.status as EmailStatus,
        priority: dto.priority || 'NORMAL',
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        sentAt: result.status === 'SENT' ? new Date() : null,
        failedAt: result.status === 'FAILED' ? new Date() : null,
        errorMessage: result.status === 'FAILED' ? 'Provider returned failure' : null,
        retryCount: 0,
        maxRetries: 3,
        idempotencyKey: dto.idempotencyKey || `email_${generateUuidV7()}`,
        correlationId: dto.correlationId,
        metadata: dto.metadata || {},
        version: 0,
      },
    });

    const event = createCloudEvent({
      type: 'email.sent',
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/notifications/email/${email.id}`,
      subject: email.id,
      propertyId,
      data: {
        propertyId,
        emailId: email.id,
        externalId: result.externalId,
        to: dto.to,
        subject,
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
        correlationId: dto.idempotencyKey || dto.correlationId || `email_sent_${email.id}`,
      },
    });

    return this.mapEmail(email);
  }

  async sendTemplatedEmail(propertyId: string, dto: SendTemplatedEmailDto): Promise<EmailDto> {
    const config = await this.findProviderConfigById(propertyId, dto.emailProviderConfigId);

    if (!config.enabled) {
      throw new BadRequestException('Email provider is disabled');
    }

    const provider = this.getProvider(config.provider);
    if (!provider) {
      throw new BadRequestException(`Provider '${config.provider}' not registered`);
    }

    // Find template by type
    const template = await this.prisma.emailTemplate.findFirst({
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
      const existing = await this.prisma.email.findFirst({
        where: { idempotencyKey: dto.idempotencyKey || `email_${generateUuidV7()}`, propertyId },
      });
      if (existing) {
        this.logger.warn(`Idempotent replay detected for Templated Email: ${dto.idempotencyKey}`);
        return this.mapEmail(existing);
      }
    }

    // Render template with variables
    const subject = this.renderTemplate(template.subject, dto.variables);
    const htmlContent = this.renderTemplate(template.htmlContent, dto.variables);
    const textContent = this.renderTemplate(template.textContent, dto.variables);

    // Send via provider
    const result = await provider.sendTemplatedEmail({
      emailProviderConfigId: dto.emailProviderConfigId,
      templateType: dto.templateType,
      to: dto.to,
      cc: dto.cc,
      bcc: dto.bcc,
      variables: dto.variables,
      priority: dto.priority,
      scheduledAt: dto.scheduledAt,
    });

    // Create email record
    const email = await this.prisma.email.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        emailProviderConfigId: dto.emailProviderConfigId,
        templateId: template.id,
        to: dto.to,
        cc: dto.cc,
        bcc: dto.bcc,
        subject,
        htmlContent,
        textContent,
        status: result.status as EmailStatus,
        priority: dto.priority || 'NORMAL',
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        sentAt: result.status === 'SENT' ? new Date() : null,
        failedAt: result.status === 'FAILED' ? new Date() : null,
        errorMessage: result.status === 'FAILED' ? 'Provider returned failure' : null,
        retryCount: 0,
        maxRetries: 3,
        idempotencyKey: dto.idempotencyKey || `email_${generateUuidV7()}`,
        correlationId: dto.correlationId,
        metadata: dto.metadata || {},
        version: 0,
      },
    });

    const event = createCloudEvent({
      type: 'email.sent',
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/notifications/email/${email.id}`,
      subject: email.id,
      propertyId,
      data: {
        propertyId,
        emailId: email.id,
        externalId: result.externalId,
        to: dto.to,
        subject,
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
        correlationId: dto.idempotencyKey || dto.correlationId || `email_sent_${email.id}`,
      },
    });

    return this.mapEmail(email);
  }

  // ============================================================================
  // EMAIL LOOKUP
  // ============================================================================

  async findEmails(propertyId: string, status?: EmailStatus, limit = 50): Promise<EmailDto[]> {
    const where: Prisma.EmailWhereInput = {
      propertyId,
      deletedAt: null,
      ...(status ? { status } : {}),
    };

    const emails = await this.prisma.email.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return emails.map(this.mapEmail);
  }

  async findEmailById(propertyId: string, id: string): Promise<EmailDto> {
    const email = await this.prisma.email.findFirst({
      where: { id, propertyId, deletedAt: null },
    });

    if (!email) {
      throw new NotFoundException(`Email '${id}' not found for property`);
    }

    return this.mapEmail(email);
  }

  // ============================================================================
  // WEBHOOK PROCESSING
  // ============================================================================

  async processWebhook(
    propertyId: string,
    emailProviderConfigId: string,
    payload: Record<string, any>,
    signature?: string,
  ): Promise<EmailWebhookDto> {
    const config = await this.findProviderConfigById(propertyId, emailProviderConfigId);
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
    const existing = await this.prisma.emailWebhook.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      this.logger.warn(`Idempotent webhook replay detected: ${idempotencyKey}`);
      return this.mapWebhook(existing);
    }

    const webhookRecord = await this.prisma.emailWebhook.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        emailProviderConfigId,
        emailId: webhook.emailId,
        eventType: webhook.eventType,
        payload: webhook.payload,
        processed: true,
        processedAt: new Date(),
        correlationId: webhook.correlationId,
        idempotencyKey,
        version: 0,
      },
    });

    // Update email status based on event type
    if (webhook.emailId) {
      const statusMap: Record<string, EmailStatus> = {
        delivered: 'DELIVERED',
        bounced: 'BOUNCED',
        complained: 'COMPLAINED',
        failed: 'FAILED',
      };

      const newStatus = statusMap[webhook.eventType];
      if (newStatus) {
        await this.prisma.email.update({
          where: { id: webhook.emailId },
          data: {
            status: newStatus,
            ...(newStatus === 'DELIVERED' && { deliveredAt: new Date() }),
            ...(newStatus === 'FAILED' && { failedAt: new Date() }),
          },
        });
      }
    }

    return this.mapWebhook(webhookRecord);
  }

  // ============================================================================
  // STATS
  // ============================================================================

  async getStats(propertyId: string, periodStart: string, periodEnd: string): Promise<EmailStatsDto> {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    const emails = await this.prisma.email.findMany({
      where: {
        propertyId,
        createdAt: { gte: start, lte: end },
        deletedAt: null,
      },
    });

    const totalSent = emails.filter((e: any) => e.status !== 'PENDING').length;
    const totalDelivered = emails.filter((e: any) => e.status === 'DELIVERED').length;
    const totalFailed = emails.filter((e: any) => e.status === 'FAILED').length;
    const totalBounced = emails.filter((e: any) => e.status === 'BOUNCED').length;
    const totalComplained = emails.filter((e: any) => e.status === 'COMPLAINED').length;

    // Get unique template IDs
    const templateIds = [...new Set(emails.map((e: any) => e.templateId).filter(Boolean))];
    const templates = await this.prisma.emailTemplate.findMany({
      where: { id: { in: templateIds } },
      select: { id: true, type: true },
    });
    const templateTypeMap = new Map(templates.map((t: any) => [t.id, t.type]));

    const byTemplate = emails.reduce((acc: Array<{ templateType: EmailTemplateType; sent: number; delivered: number; failed: number }>, email: any) => {
      if (email.templateId) {
        const type = templateTypeMap.get(email.templateId);
        if (type) {
          const existing = acc.find((t) => t.templateType === type);
          if (existing) {
            existing.sent++;
            if (email.status === 'DELIVERED') existing.delivered++;
            if (email.status === 'FAILED' || email.status === 'BOUNCED') existing.failed++;
          } else {
            acc.push({
              templateType: type,
              sent: 1,
              delivered: email.status === 'DELIVERED' ? 1 : 0,
              failed: email.status === 'FAILED' || email.status === 'BOUNCED' ? 1 : 0,
            });
          }
        }
      }
      return acc;
    }, [] as Array<{ templateType: EmailTemplateType; sent: number; delivered: number; failed: number }>);

    return {
      propertyId,
      periodStart,
      periodEnd,
      totalSent,
      totalDelivered,
      totalFailed,
      totalBounced,
      totalComplained,
      deliveryRate: totalSent > 0 ? totalDelivered / totalSent : 0,
      bounceRate: totalSent > 0 ? totalBounced / totalSent : 0,
      complaintRate: totalSent > 0 ? totalComplained / totalSent : 0,
      byTemplate,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private renderTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapProviderConfig = (c: any): EmailProviderConfigDto => ({
    id: c.id,
    propertyId: c.propertyId,
    provider: c.provider as EmailProviderType,
    name: c.name,
    enabled: c.enabled,
    configuration: c.configuration as Record<string, any>,
    fromEmail: c.fromEmail,
    fromName: c.fromName,
    lastSyncAt: c.lastSyncAt?.toISOString() || null,
    lastError: c.lastError,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  });

  private mapTemplate = (t: any): EmailTemplateDto => ({
    id: t.id,
    propertyId: t.propertyId,
    type: t.type as EmailTemplateType,
    name: t.name,
    subject: t.subject,
    htmlContent: t.htmlContent,
    textContent: t.textContent,
    variables: t.variables as string[],
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  });

  private mapEmail = (e: any): EmailDto => ({
    id: e.id,
    propertyId: e.propertyId,
    emailProviderConfigId: e.emailProviderConfigId,
    templateId: e.templateId,
    to: e.to as string[],
    cc: e.cc as string[] | undefined,
    bcc: e.bcc as string[] | undefined,
    subject: e.subject,
    htmlContent: e.htmlContent,
    textContent: e.textContent,
    status: e.status as EmailStatus,
    priority: e.priority,
    scheduledAt: e.scheduledAt?.toISOString() || null,
    sentAt: e.sentAt?.toISOString() || null,
    deliveredAt: e.deliveredAt?.toISOString() || null,
    failedAt: e.failedAt?.toISOString() || null,
    errorMessage: e.errorMessage,
    retryCount: e.retryCount,
    maxRetries: e.maxRetries,
    idempotencyKey: e.idempotencyKey,
    correlationId: e.correlationId,
    metadata: e.metadata as Record<string, any>,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  });

  private mapWebhook = (w: any): EmailWebhookDto => ({
    id: w.id,
    propertyId: w.propertyId,
    emailProviderConfigId: w.emailProviderConfigId,
    emailId: w.emailId,
    eventType: w.eventType,
    payload: w.payload as Record<string, any>,
    processed: w.processed,
    processedAt: w.processedAt?.toISOString() || null,
    correlationId: w.correlationId,
    idempotencyKey: w.idempotencyKey,
    createdAt: w.createdAt.toISOString(),
  });
}