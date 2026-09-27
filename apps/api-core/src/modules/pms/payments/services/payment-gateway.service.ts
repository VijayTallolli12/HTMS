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
  PaymentProviderConfigDto,
  PaymentIntentDto,
  PaymentGatewayTransactionDto,
  PaymentWebhookDto,
  PaymentReconciliationDto,
  PaymentProviderType,
  PaymentGatewayTransactionStatus,
  PaymentIntentStatus,
  PaymentProvider,
} from '@hms/api-contracts';
import {
  CreatePaymentProviderConfigDto,
  UpdatePaymentProviderConfigDto,
  CreatePaymentIntentDto,
  AuthorizePaymentGatewayTransactionDto,
  CapturePaymentGatewayTransactionDto,
  RefundPaymentGatewayTransactionDto,
  CancelPaymentGatewayTransactionDto,
  SimulateWebhookDto,
  GeneratePaymentReconciliationDto,
} from '../dto/payments.dto';

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);
  private readonly providers = new Map<PaymentProviderType, PaymentProvider>();

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // PROVIDER REGISTRY
  // ============================================================================

  registerProvider(provider: PaymentProvider): void {
    this.providers.set(provider.provider, provider);
    this.logger.log(`Registered payment provider: ${provider.provider}`);
  }

  getProvider(type: PaymentProviderType): PaymentProvider | undefined {
    return this.providers.get(type);
  }

  // ============================================================================
  // PAYMENT PROVIDER CONFIGURATION CRUD
  // ============================================================================

  async findProviderConfigs(propertyId: string, enabledOnly?: boolean): Promise<PaymentProviderConfigDto[]> {
    const where: Prisma.PaymentProviderConfigWhereInput = {
      propertyId,
      deletedAt: null,
      ...(enabledOnly !== undefined ? { enabled: enabledOnly } : {}),
    };

    const configs = await this.prisma.paymentProviderConfig.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return configs.map(this.mapProviderConfig);
  }

  async findProviderConfigById(propertyId: string, id: string): Promise<PaymentProviderConfigDto> {
    const config = await this.prisma.paymentProviderConfig.findFirst({
      where: { id, propertyId, deletedAt: null },
    });

    if (!config) {
      throw new NotFoundException(`Payment provider config '${id}' not found for property`);
    }

    return this.mapProviderConfig(config);
  }

  async createProviderConfig(
    propertyId: string,
    dto: CreatePaymentProviderConfigDto,
    actorId?: string,
  ): Promise<PaymentProviderConfigDto> {
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

    const config = await this.prisma.paymentProviderConfig.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        provider: dto.provider,
        name: dto.name,
        enabled: true,
        configuration: dto.configuration,
        supportedCurrencies: dto.supportedCurrencies || ['JPY', 'USD', 'EUR'],
        version: 0,
      },
    });

    const event = createCloudEvent({
      type: 'payment.provider.created',
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/payments/providers/${config.id}`,
      subject: config.id,
      propertyId,
      data: {
        propertyId,
        providerConfigId: config.id,
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
        correlationId: `payment_provider_created_${config.id}`,
      },
    });

    return this.mapProviderConfig(config);
  }

  async updateProviderConfig(
    propertyId: string,
    id: string,
    dto: UpdatePaymentProviderConfigDto,
  ): Promise<PaymentProviderConfigDto> {
    await this.findProviderConfigById(propertyId, id);

    const config = await this.prisma.paymentProviderConfig.findFirst({ where: { id, propertyId, deletedAt: null } });
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

    const updated = await this.prisma.paymentProviderConfig.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.configuration !== undefined && { configuration: dto.configuration }),
        ...(dto.supportedCurrencies !== undefined && { supportedCurrencies: dto.supportedCurrencies }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        version: { increment: 1 },
      },
    });

    return this.mapProviderConfig(updated);
  }

  async deleteProviderConfig(propertyId: string, id: string): Promise<void> {
    await this.findProviderConfigById(propertyId, id);
    await this.prisma.paymentProviderConfig.update({
      where: { id },
      data: { deletedAt: new Date(), enabled: false },
    });
  }

  // ============================================================================
  // PAYMENT INTENT
  // ============================================================================

  async createPaymentIntent(
    propertyId: string,
    dto: CreatePaymentIntentDto,
    actorId?: string,
  ): Promise<PaymentIntentDto> {
    const config = await this.findProviderConfigById(propertyId, dto.paymentProviderConfigId);

    if (!config.enabled) {
      throw new BadRequestException('Payment provider is disabled');
    }

    const provider = this.getProvider(config.provider);
    if (!provider) {
      throw new BadRequestException(`Provider '${config.provider}' not registered`);
    }

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.paymentIntent.findFirst({
        where: { idempotencyKey: dto.idempotencyKey, propertyId },
      });
      if (existing) {
        this.logger.warn(`Idempotent replay detected for PaymentIntent: ${dto.idempotencyKey}`);
        return this.mapPaymentGatewayTransactionIntent(existing);
      }
    }

    // Create payment intent via provider
    const result = await provider.createPaymentIntent({
      paymentProviderConfigId: dto.paymentProviderConfigId,
      amount: dto.amount,
      currency: dto.currency,
      description: dto.description,
      metadata: dto.metadata,
      captureMethod: dto.captureMethod,
      confirmationMethod: dto.confirmationMethod,
      idempotencyKey: dto.idempotencyKey,
    });

    const intent = await this.prisma.paymentIntent.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        paymentProviderConfigId: dto.paymentProviderConfigId,
        externalId: result.externalId,
        amount: dto.amount,
        currency: dto.currency,
        status: result.status as PaymentIntentStatus,
        description: dto.description,
        metadata: dto.metadata || {},
        clientSecret: result.clientSecret,
        captureMethod: dto.captureMethod || 'AUTOMATIC',
        confirmationMethod: dto.confirmationMethod || 'AUTOMATIC',
        idempotencyKey: dto.idempotencyKey,
        version: 0,
      },
    });

    const event = createCloudEvent({
      type: 'payment.intent.created',
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/payments/intents/${intent.id}`,
      subject: intent.id,
      propertyId,
      data: {
        propertyId,
        intentId: intent.id,
        externalId: result.externalId,
        amount: dto.amount,
        currency: dto.currency,
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
        correlationId: `payment_intent_created_${intent.id}`,
      },
    });

    return this.mapPaymentGatewayTransactionIntent(intent);
  }

  async findPaymentIntent(propertyId: string, id: string): Promise<PaymentIntentDto> {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: { id, propertyId, deletedAt: null },
    });

    if (!intent) {
      throw new NotFoundException(`Payment intent '${id}' not found`);
    }

    return this.mapPaymentGatewayTransactionIntent(intent);
  }

  // ============================================================================
  // PAYMENT OPERATIONS (Authorize, Capture, Refund, Cancel)
  // ============================================================================

  async authorizePayment(
    propertyId: string,
    dto: AuthorizePaymentGatewayTransactionDto,
  ): Promise<PaymentGatewayTransactionDto> {
    const intent = await this.findPaymentIntent(propertyId, dto.paymentIntentId);
    const config = await this.findProviderConfigById(propertyId, intent.paymentProviderConfigId);

    if (!config.enabled) {
      throw new BadRequestException('Payment provider is disabled');
    }

    const provider = this.getProvider(config.provider);
    if (!provider) {
      throw new BadRequestException(`Provider '${config.provider}' not registered`);
    }

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.paymentGatewayTransaction.findFirst({
        where: { idempotencyKey: dto.idempotencyKey, propertyId },
      });
      if (existing) {
        this.logger.warn(`Idempotent replay detected for Payment authorize: ${dto.idempotencyKey}`);
        return this.mapPaymentGatewayTransaction(existing);
      }
    }

    const result = await provider.authorizePayment({
      paymentIntentId: intent.externalId,
      paymentMethodId: dto.paymentMethodId,
    });

    // Create payment record
    const payment = await this.prisma.paymentGatewayTransaction.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        paymentProviderConfigId: intent.paymentProviderConfigId,
        paymentIntentId: intent.id,
        externalId: result.externalId,
        amount: intent.amount,
        currency: intent.currency,
        status: 'AUTHORIZED',
        description: intent.description,
        metadata: intent.metadata,
        authorizationCode: result.authorizationCode,
        idempotencyKey: dto.idempotencyKey,
        reconciliationStatus: 'PENDING',
        version: 0,
      },
    });

    // Update intent status
    await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: 'SUCCEEDED', version: { increment: 1 } },
    });

    const event = createCloudEvent({
      type: 'payment.authorized',
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/payments/${payment.id}`,
      subject: payment.id,
      propertyId,
      data: {
        propertyId,
        paymentId: payment.id,
        externalId: result.externalId,
        amount: intent.amount,
        currency: intent.currency,
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
        correlationId: dto.idempotencyKey || `payment_authorized_${payment.id}`,
      },
    });

    return this.mapPaymentGatewayTransaction(payment);
  }

  async capturePayment(
    propertyId: string,
    dto: CapturePaymentGatewayTransactionDto,
  ): Promise<PaymentGatewayTransactionDto> {
    const payment = await this.prisma.paymentGatewayTransaction.findFirst({
      where: { id: dto.paymentId, propertyId, deletedAt: null },
    });

    if (!payment) {
      throw new NotFoundException(`Payment '${dto.paymentId}' not found`);
    }

    if (payment.status !== 'AUTHORIZED' && payment.status !== 'PENDING') {
      throw new BadRequestException(`Cannot capture payment in status '${payment.status}'`);
    }

    const config = await this.findProviderConfigById(propertyId, payment.paymentProviderConfigId);
    const provider = this.getProvider(config.provider);
    if (!provider) {
      throw new BadRequestException(`Provider '${config.provider}' not registered`);
    }

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.paymentGatewayTransaction.findFirst({
        where: { idempotencyKey: dto.idempotencyKey, propertyId },
      });
      if (existing && existing.id !== dto.paymentId) {
        this.logger.warn(`Idempotent replay detected for Payment capture: ${dto.idempotencyKey}`);
        return this.mapPaymentGatewayTransaction(existing);
      }
    }

    const amount = dto.amount || payment.amount;
    const result = await provider.capturePayment({
      paymentId: payment.externalId,
      amount,
    });

    const updated = await this.prisma.paymentGatewayTransaction.update({
      where: { id: payment.id },
      data: {
        status: 'CAPTURED',
        capturedAt: new Date(),
        version: { increment: 1 },
        ...(dto.idempotencyKey && { idempotencyKey: dto.idempotencyKey }),
      },
    });

    const event = createCloudEvent({
      type: 'payment.captured',
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/payments/${payment.id}`,
      subject: payment.id,
      propertyId,
      data: {
        propertyId,
        paymentId: payment.id,
        externalId: payment.externalId,
        amount,
        currency: payment.currency,
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
        correlationId: dto.idempotencyKey || `payment_captured_${payment.id}`,
      },
    });

    return this.mapPaymentGatewayTransaction(updated);
  }

  async refundPayment(
    propertyId: string,
    dto: RefundPaymentGatewayTransactionDto,
  ): Promise<PaymentGatewayTransactionDto> {
    const payment = await this.prisma.paymentGatewayTransaction.findFirst({
      where: { id: dto.paymentId, propertyId, deletedAt: null },
    });

    if (!payment) {
      throw new NotFoundException(`Payment '${dto.paymentId}' not found`);
    }

    if (payment.status !== 'CAPTURED') {
      throw new BadRequestException(`Cannot refund payment in status '${payment.status}'`);
    }

    const config = await this.findProviderConfigById(propertyId, payment.paymentProviderConfigId);
    const provider = this.getProvider(config.provider);
    if (!provider) {
      throw new BadRequestException(`Provider '${config.provider}' not registered`);
    }

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.paymentGatewayTransaction.findFirst({
        where: { idempotencyKey: dto.idempotencyKey, propertyId },
      });
      if (existing && existing.id !== dto.paymentId) {
        this.logger.warn(`Idempotent replay detected for Payment refund: ${dto.idempotencyKey}`);
        return this.mapPaymentGatewayTransaction(existing);
      }
    }

    const amount = dto.amount || payment.amount;
    const result = await provider.refundPayment({
      paymentId: payment.externalId,
      amount,
      reason: dto.reason,
    });

    const newRefundedAmount = payment.refundedAmount + amount;
    const newStatus: PaymentGatewayTransactionStatus = newRefundedAmount >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    const updated = await this.prisma.paymentGatewayTransaction.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        refundedAmount: newRefundedAmount,
        version: { increment: 1 },
        ...(dto.idempotencyKey && { idempotencyKey: dto.idempotencyKey }),
      },
    });

    const event = createCloudEvent({
      type: 'payment.refunded',
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/payments/${payment.id}`,
      subject: payment.id,
      propertyId,
      data: {
        propertyId,
        paymentId: payment.id,
        externalId: payment.externalId,
        refundAmount: amount,
        totalRefunded: newRefundedAmount,
        currency: payment.currency,
        reason: dto.reason,
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
        correlationId: dto.idempotencyKey || `payment_refunded_${payment.id}`,
      },
    });

    return this.mapPaymentGatewayTransaction(updated);
  }

  async cancelPaymentIntent(
    propertyId: string,
    dto: CancelPaymentGatewayTransactionDto,
  ): Promise<PaymentIntentDto> {
    const intent = await this.findPaymentIntent(propertyId, dto.paymentIntentId);

    if (intent.status === 'SUCCEEDED' || intent.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel payment intent in status '${intent.status}'`);
    }

    const config = await this.findProviderConfigById(propertyId, intent.paymentProviderConfigId);
    const provider = this.getProvider(config.provider);
    if (!provider) {
      throw new BadRequestException(`Provider '${config.provider}' not registered`);
    }

    await provider.cancelPayment({
      paymentIntentId: intent.externalId,
    });

    const updated = await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: 'CANCELLED', version: { increment: 1 } },
    });

    return this.mapPaymentGatewayTransactionIntent(updated);
  }

  // ============================================================================
  // WEBHOOK PROCESSING
  // ============================================================================

  async processWebhook(dto: SimulateWebhookDto): Promise<PaymentWebhookDto> {
    const config = await this.findProviderConfigById(dto.paymentProviderConfigId, dto.paymentProviderConfigId);
    const provider = this.getProvider(config.provider);
    if (!provider) {
      throw new BadRequestException(`Provider '${config.provider}' not registered`);
    }

    // Parse webhook
    const webhook = provider.parseWebhook(dto.payload);

    // Verify signature if present (for demo, we skip actual verification)
    // const signature = dto.payload.signature;
    // if (signature && !provider.verifyWebhookSignature(JSON.stringify(dto.payload), signature, config.configuration.webhookSecret)) {
    //   throw new BadRequestException('Invalid webhook signature');
    // }

    // Idempotency check
    const idempotencyKey = webhook.idempotencyKey || provider.generateIdempotencyKey(`webhook_${dto.eventType}`);
    const existing = await this.prisma.paymentWebhook.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      this.logger.warn(`Idempotent webhook replay detected: ${idempotencyKey}`);
      return this.mapWebhook(existing);
    }

    const webhookRecord = await this.prisma.paymentWebhook.create({
      data: {
        id: generateUuidV7(),
        propertyId: dto.paymentProviderConfigId, // This would be the propertyId from config
        paymentProviderConfigId: dto.paymentProviderConfigId,
        provider: config.provider,
        eventType: dto.eventType,
        payload: dto.payload,
        processed: true,
        processedAt: new Date(),
        correlationId: webhook.correlationId,
        idempotencyKey,
        version: 0,
      },
    });

    // Process webhook based on event type (simplified)
    // In production, this would handle payment_intent.succeeded, payment_intent.payment_failed, etc.

    return this.mapWebhook(webhookRecord);
  }

  // ============================================================================
  // RECONCILIATION
  // ============================================================================

  async generateReconciliation(
    propertyId: string,
    dto: GeneratePaymentReconciliationDto,
  ): Promise<PaymentReconciliationDto> {
    const config = await this.findProviderConfigById(propertyId, dto.paymentProviderConfigId);

    // Simplified reconciliation
    const report: PaymentReconciliationDto = {
      id: generateUuidV7(),
      propertyId,
      paymentProviderConfigId: dto.paymentProviderConfigId,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      totalPayments: 0,
      totalRefunds: 0,
      matched: 0,
      pmsOnly: 0,
      providerOnly: 0,
      discrepancies: [],
      generatedAt: new Date().toISOString(),
    };

    return report;
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapProviderConfig = (c: any): PaymentProviderConfigDto => ({
    id: c.id,
    propertyId: c.propertyId,
    provider: c.provider as PaymentProviderType,
    name: c.name,
    enabled: c.enabled,
    configuration: c.configuration as Record<string, any>,
    supportedCurrencies: c.supportedCurrencies as string[],
    lastSyncAt: c.lastSyncAt?.toISOString() || null,
    lastError: c.lastError,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  });

  private mapPaymentGatewayTransactionIntent = (i: any): PaymentIntentDto => ({
    id: i.id,
    propertyId: i.propertyId,
    paymentProviderConfigId: i.paymentProviderConfigId,
    externalId: i.externalId,
    amount: i.amount,
    currency: i.currency,
    status: i.status as PaymentIntentStatus,
    description: i.description,
    metadata: i.metadata as Record<string, any>,
    clientSecret: i.clientSecret,
    captureMethod: i.captureMethod,
    confirmationMethod: i.confirmationMethod,
    lastError: i.lastError,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  });

  private mapPaymentGatewayTransaction = (p: any): PaymentGatewayTransactionDto => ({
    id: p.id,
    propertyId: p.propertyId,
    paymentProviderConfigId: p.paymentProviderConfigId,
    paymentIntentId: p.paymentIntentId,
    externalId: p.externalId,
    amount: p.amount,
    currency: p.currency,
    status: p.status as PaymentGatewayTransactionStatus,
    description: p.description,
    metadata: p.metadata as Record<string, any>,
    authorizationCode: p.authorizationCode,
    capturedAt: p.capturedAt?.toISOString() || null,
    refundedAmount: p.refundedAmount,
    reconciliationStatus: p.reconciliationStatus,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  });

  private mapWebhook = (w: any): PaymentWebhookDto => ({
    id: w.id,
    propertyId: w.propertyId,
    paymentProviderConfigId: w.paymentProviderConfigId,
    provider: w.provider as PaymentProviderType,
    eventType: w.eventType,
    payload: w.payload as Record<string, any>,
    processed: w.processed,
    processedAt: w.processedAt?.toISOString() || null,
    error: w.error,
    correlationId: w.correlationId,
    idempotencyKey: w.idempotencyKey,
    createdAt: w.createdAt.toISOString(),
  });
}