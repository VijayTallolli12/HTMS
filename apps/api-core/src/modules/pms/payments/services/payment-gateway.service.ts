import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
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
  PaymentMethod,
  SimulateWebhookDto,
} from '@hms/api-contracts';
import {
  CreatePaymentProviderConfigDto,
  UpdatePaymentProviderConfigDto,
  CreatePaymentIntentDto,
  AuthorizePaymentGatewayTransactionDto,
  CapturePaymentGatewayTransactionDto,
  RefundPaymentGatewayTransactionDto,
  CancelPaymentGatewayTransactionDto,
  GeneratePaymentReconciliationDto,
} from '../dto/payments.dto';
import { DemoPaymentGatewayAdapter } from './demo-payment-gateway.adapter';
import { PaymentGatewayCredentialVault } from './payment-gateway-credential-vault';
import { PaymentGatewayProviderRegistry } from './payment-gateway-registry';
import { SecurityContext } from '@hms/api-contracts';
import { PaymentGatewayFinancialOperationsService } from './payment-gateway-financial-operations.service';
import { PaymentGatewayReconciliationService } from './payment-gateway-reconciliation.service';
import { minorUnitsToLedgerUnits, folioAmountToLedgerUnits } from './payment-currency';
import { createHash } from 'crypto';

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);
  private readonly providers = new Map<PaymentProviderType, PaymentProvider>();
  private readonly demoAdapter = new DemoPaymentGatewayAdapter();
  private readonly credentialVault = new PaymentGatewayCredentialVault();
  private readonly catalog = new PaymentGatewayProviderRegistry();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly financialOperations?: PaymentGatewayFinancialOperationsService,
    @Optional() private readonly reconciliationService?: PaymentGatewayReconciliationService,
  ) {
    this.registerProvider(this.demoAdapter);
  }

  registerProvider(provider: PaymentProvider): void {
    this.providers.set(provider.provider, provider);
    this.logger.log(`Registered payment adapter: ${provider.provider}`);
  }

  getProvider(type: PaymentProviderType): PaymentProvider | undefined {
    return this.providers.get(type);
  }

  async findProviderConfigs(propertyId: string, enabledOnly?: boolean): Promise<PaymentProviderConfigDto[]> {
    const configs = await this.prisma.paymentProviderConfig.findMany({
      where: { propertyId, deletedAt: null, ...(enabledOnly !== undefined ? { enabled: enabledOnly } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return configs.map(this.mapProviderConfig);
  }

  async findProviderConfigById(propertyId: string, id: string): Promise<PaymentProviderConfigDto> {
    const config = await this.prisma.paymentProviderConfig.findFirst({ where: { id, propertyId, deletedAt: null } });
    if (!config) throw new NotFoundException(`Payment provider config '${id}' not found for property`);
    return this.mapProviderConfig(config);
  }

  async createProviderConfig(propertyId: string, dto: CreatePaymentProviderConfigDto, actorId?: string): Promise<PaymentProviderConfigDto> {
    const provider = this.getProvider(dto.provider);
    if (!provider) throw new BadRequestException(`No executable adapter is registered for '${dto.provider}'.`);
    const catalog = this.catalog.get(dto.provider);
    if (!catalog) throw new BadRequestException(`Provider '${dto.provider}' is missing from the catalog.`);
    const configuration = this.encryptLegacyConfiguration(catalog, dto.configuration);
    if (dto.provider === 'DEMO') {
      await provider.configure(dto.configuration);
      const health = await provider.healthCheck();
      if (!health.healthy) throw new BadRequestException('Demo adapter configuration validation failed.');
    }
    const config = await this.prisma.paymentProviderConfig.create({
      data: {
        id: generateUuidV7(), propertyId, provider: dto.provider, name: dto.name, enabled: false,
        configuration: configuration as Prisma.InputJsonValue,
        supportedCurrencies: dto.supportedCurrencies || ['JPY', 'USD', 'EUR'],
        environment: 'SANDBOX', priority: 100, isPrimary: false, enabledPaymentMethods: [],
        integrationStatus: catalog.adapterStatus === 'DEMO_ADAPTER' ? 'DEMO_ADAPTER' : 'CONFIGURED', version: 0,
      },
    });
    const event = createCloudEvent({
      type: 'payment.provider.created',
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/payments/providers/${config.id}`,
      subject: config.id,
      propertyId,
      data: { propertyId, providerConfigId: config.id, provider: dto.provider, name: dto.name, actorId },
    });
    await this.prisma.outboxEvent.create({
      data: {
        id: event.id, specversion: event.specversion, type: event.type, source: event.source,
        subject: event.subject, propertyId, datacontenttype: event.datacontenttype,
        time: new Date(event.time), data: event.data as any, correlationId: `payment_provider_created_${config.id}`,
      },
    });
    return this.mapProviderConfig(config);
  }

  async updateProviderConfig(propertyId: string, id: string, dto: UpdatePaymentProviderConfigDto): Promise<PaymentProviderConfigDto> {
    const current = await this.prisma.paymentProviderConfig.findFirst({ where: { id, propertyId, deletedAt: null } });
    if (!current) throw new NotFoundException(`Payment provider config '${id}' not found for property`);
    const provider = this.getProvider(current.provider);
    if (!provider) throw new BadRequestException(`No executable adapter is registered for '${current.provider}'.`);
    const catalog = this.catalog.get(current.provider);
    const merged = dto.configuration === undefined ? undefined : {
      ...this.decryptLegacyConfiguration(catalog, current.configuration as Record<string, unknown>),
      ...dto.configuration,
    };
    const configuration = merged === undefined ? undefined : this.encryptLegacyConfiguration(catalog, merged);
    if (dto.configuration !== undefined && current.provider === 'DEMO') {
      await provider.configure(merged!);
      const health = await provider.healthCheck();
      if (!health.healthy) throw new BadRequestException('Demo adapter configuration validation failed.');
    }
    const updated = await this.prisma.paymentProviderConfig.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(configuration !== undefined && { configuration: configuration as Prisma.InputJsonValue }),
        ...(dto.supportedCurrencies !== undefined && { supportedCurrencies: dto.supportedCurrencies }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled && current.provider === 'DEMO' }),
        version: { increment: 1 },
      },
    });
    return this.mapProviderConfig(updated);
  }

  async deleteProviderConfig(propertyId: string, id: string): Promise<void> {
    await this.findProviderConfigById(propertyId, id);
    await this.prisma.paymentProviderConfig.update({ where: { id }, data: { deletedAt: new Date(), enabled: false, isPrimary: false } });
  }

  async createPaymentIntent(propertyId: string, dto: CreatePaymentIntentDto, actor?: SecurityContext): Promise<PaymentIntentDto> {
    const config = await this.requireEnabledDemoConfig(propertyId, dto.paymentProviderConfigId);
    const currency = dto.currency.trim().toUpperCase();
    const requestedUnits = minorUnitsToLedgerUnits(dto.amount, currency);
    if (!Number.isSafeInteger(dto.amount) || dto.amount > 2_147_483_647) throw new BadRequestException('Payment amount exceeds the supported gateway amount range.');
    if (!config.supportedCurrencies.includes(currency)) throw new BadRequestException('Currency is not enabled for this gateway.');
    if (dto.folioId) {
      const folio = await this.prisma.folio.findFirst({ where: { id: dto.folioId, propertyId } });
      if (!folio || folio.status !== 'OPEN') throw new NotFoundException('Open folio not found for this property.');
      if (folio.currency.toUpperCase() !== currency) throw new BadRequestException('Payment currency must match the folio currency.');
      if (folioAmountToLedgerUnits(String(folio.balance), currency) < requestedUnits) throw new BadRequestException('Payment request exceeds the folio balance.');
      const reservation = await this.prisma.reservation.findFirst({ where: { id: folio.reservationId, propertyId, status: 'CHECKED_IN', deletedAt: null } });
      if (!reservation) throw new BadRequestException('A Folio payment requires a CHECKED_IN reservation.');
    }
    if (!dto.idempotencyKey?.trim()) throw new BadRequestException('Idempotency-Key is required for payment intent creation.');
    const idempotencyKey = dto.idempotencyKey.trim();
    if (idempotencyKey.length > 64) throw new BadRequestException('Idempotency key may not exceed 64 characters.');
    const requestHash = createHash('sha256').update(JSON.stringify({ propertyId, paymentProviderConfigId: dto.paymentProviderConfigId, folioId: dto.folioId || null, amount: dto.amount, currency, description: dto.description || null, metadata: dto.metadata || {}, captureMethod: dto.captureMethod || 'AUTOMATIC', confirmationMethod: dto.confirmationMethod || 'AUTOMATIC', idempotencyKey })).digest('hex');
    const existingIntent = await this.prisma.paymentIntent.findFirst({ where: { idempotencyKey, propertyId } });
    if (existingIntent) {
      const existingHash = createHash('sha256').update(JSON.stringify({ propertyId, paymentProviderConfigId: existingIntent.paymentProviderConfigId, folioId: existingIntent.folioId, amount: existingIntent.amount, currency: existingIntent.currency, description: existingIntent.description, metadata: existingIntent.metadata, captureMethod: existingIntent.captureMethod, confirmationMethod: existingIntent.confirmationMethod, idempotencyKey })).digest('hex');
      if (existingHash !== requestHash) {
        throw new ConflictException('Idempotency key was reused with a different payment request.');
      }
      return this.mapPaymentGatewayTransactionIntent(existingIntent);
    }
    const provider = this.getProvider(config.provider)!;
    const externalId = `DEMO-INTENT-${createHash('sha256').update(`${propertyId}:${config.id}:${idempotencyKey}`).digest('hex').slice(0, 32)}`;
    const clientSecret = `demo_${createHash('sha256').update(`${externalId}:client`).digest('hex').slice(0, 32)}`;
    try {
      const intent = await this.prisma.paymentIntent.create({
        data: {
          id: generateUuidV7(), propertyId, paymentProviderConfigId: dto.paymentProviderConfigId,
          externalId, amount: dto.amount, currency,
          status: 'REQUIRES_PAYMENT_METHOD', description: dto.description, metadata: dto.metadata || {},
          clientSecret, captureMethod: dto.captureMethod || 'AUTOMATIC',
          confirmationMethod: dto.confirmationMethod || 'AUTOMATIC', idempotencyKey, version: 0,
          folioId: dto.folioId,
        },
      });
      if (dto.folioId) {
        const folio = await this.prisma.folio.findFirst({ where: { id: dto.folioId, propertyId, status: 'OPEN' } });
        if (!folio || folio.currency.toUpperCase() !== currency || folioAmountToLedgerUnits(String(folio.balance), currency) < requestedUnits) {
          await this.prisma.paymentIntent.updateMany({ where: { propertyId, id: intent.id }, data: { status: 'CANCELLED', lastError: 'Folio became unavailable before payment intent persistence completed.' } });
          throw new BadRequestException('Payment request no longer matches the open folio balance or currency.');
        }
      }
      const result = await provider.createPaymentIntent({
        paymentProviderConfigId: dto.paymentProviderConfigId, amount: dto.amount, currency,
        description: dto.description, metadata: dto.metadata, captureMethod: dto.captureMethod,
        confirmationMethod: dto.confirmationMethod, idempotencyKey,
      });
      if (!result.externalId || result.status !== 'REQUIRES_PAYMENT_METHOD') {
        await this.prisma.paymentIntent.updateMany({ where: { propertyId, id: intent.id, status: 'REQUIRES_PAYMENT_METHOD' }, data: { status: 'CANCELLED', lastError: 'Provider intent outcome did not match the durable reservation.' } });
        throw new ConflictException('Provider returned an inconsistent payment intent result; do not retry with a new key.');
      }
      await this.prisma.paymentIntent.updateMany({ where: { propertyId, id: intent.id, status: 'REQUIRES_PAYMENT_METHOD' }, data: { externalId: result.externalId, clientSecret: result.clientSecret } });
      const persistedIntent = await this.prisma.paymentIntent.findFirst({ where: { propertyId, id: intent.id } });
      if (!persistedIntent || persistedIntent.idempotencyKey !== idempotencyKey) throw new ConflictException('Durable payment intent reservation could not be confirmed.');
      await this.createOutboxEvent(propertyId, 'payment.intent.created', intent.id, {
        propertyId, intentId: intent.id, amount: dto.amount, currency, actorId: actor?.userId,
      }, idempotencyKey);
      return this.mapPaymentGatewayTransactionIntent(persistedIntent);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const winner = await this.prisma.paymentIntent.findFirst({ where: { propertyId, idempotencyKey } });
        if (winner) {
        const winnerHash = createHash('sha256').update(JSON.stringify({ propertyId, paymentProviderConfigId: winner.paymentProviderConfigId, folioId: winner.folioId, amount: winner.amount, currency: winner.currency, description: winner.description, metadata: winner.metadata, captureMethod: winner.captureMethod, confirmationMethod: winner.confirmationMethod, idempotencyKey })).digest('hex');
        if (winnerHash !== requestHash) throw new ConflictException('Idempotency key was concurrently used for a different payment request.');
        return this.mapPaymentGatewayTransactionIntent(winner);
      }
      }
      throw error;
    }
  }

  async findPaymentIntent(propertyId: string, id: string): Promise<PaymentIntentDto> {
    const intent = await this.prisma.paymentIntent.findFirst({ where: { id, propertyId, deletedAt: null } });
    if (!intent) throw new NotFoundException(`Payment intent '${id}' not found`);
    return this.mapPaymentGatewayTransactionIntent(intent);
  }

  async authorizePayment(propertyId: string, dto: AuthorizePaymentGatewayTransactionDto, actor?: SecurityContext): Promise<PaymentGatewayTransactionDto> {
    if (!this.financialOperations || !actor) throw new BadRequestException('Durable financial operations require an authenticated actor.');
    return this.financialOperations.authorize(propertyId, dto, actor);
  }

  async capturePayment(propertyId: string, dto: CapturePaymentGatewayTransactionDto, actor?: SecurityContext): Promise<PaymentGatewayTransactionDto> {
    if (!this.financialOperations || !actor) throw new BadRequestException('Durable financial operations require an authenticated actor.');
    return this.financialOperations.capture(propertyId, dto, actor);
  }

  async refundPayment(propertyId: string, dto: RefundPaymentGatewayTransactionDto, actor?: SecurityContext): Promise<PaymentGatewayTransactionDto> {
    if (!this.financialOperations || !actor) throw new BadRequestException('Durable financial operations require an authenticated actor.');
    return this.financialOperations.refund(propertyId, dto, actor);
  }

  async cancelPaymentIntent(propertyId: string, dto: CancelPaymentGatewayTransactionDto, actor?: SecurityContext): Promise<PaymentIntentDto> {
    if (!this.financialOperations || !actor) throw new BadRequestException('Durable financial operations require an authenticated actor.');
    return this.financialOperations.cancel(propertyId, dto, actor);
  }

  async processWebhook(
    propertyId: string,
    dto: SimulateWebhookDto,
    signature?: string,
    correlationId?: string,
    rawBody?: Buffer,
  ): Promise<PaymentWebhookDto> {
    const configRecord = await this.prisma.paymentProviderConfig.findFirst({ where: { id: dto.paymentProviderConfigId, propertyId, deletedAt: null } });
    if (!configRecord || configRecord.propertyId !== propertyId) throw new NotFoundException('Payment provider configuration not found for property.');
    if (configRecord.provider !== 'DEMO') throw new BadRequestException('Catalog-only providers have no webhook adapter.');
    const provider = this.getProvider(configRecord.provider);
    if (!provider) throw new BadRequestException('No webhook adapter registered.');
    const webhookSecret = this.readWebhookSecret(configRecord.configuration as Record<string, unknown>);
    if (!rawBody || !signature || !provider.verifyWebhookSignature(rawBody.toString('utf8'), signature, webhookSecret)) {
      throw new BadRequestException('Webhook signature verification failed.');
    }
    let signedRequest: any;
    try {
      signedRequest = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Signed webhook body is not valid JSON.');
    }
    if (signedRequest?.paymentProviderConfigId !== dto.paymentProviderConfigId
      || signedRequest?.eventType !== dto.eventType
      || JSON.stringify(signedRequest?.payload) !== JSON.stringify(dto.payload)) {
      throw new BadRequestException('Webhook request fields do not match the signed body.');
    }
    const webhook = provider.parseWebhook(dto.payload);
    const safePayload = this.redactSensitivePayload(dto.payload) as Record<string, unknown>;
    const canonicalPayload = JSON.stringify(dto.payload);
    const eventIdentity = String((dto.payload as any).eventId || webhook.idempotencyKey || createHash('sha256').update(`${dto.eventType}:${canonicalPayload}`).digest('hex'));
    const idempotencyKey = createHash('sha256').update(`${propertyId}:${configRecord.id}:${configRecord.provider}:${eventIdentity}`).digest('hex');
    if (webhook.idempotencyKey && webhook.idempotencyKey !== eventIdentity) {
      throw new BadRequestException('Webhook event identity is inconsistent.');
    }
    if (eventIdentity.length > 256) throw new BadRequestException('Webhook event identity exceeds the supported length.');
    const scopedKey = idempotencyKey;
    const existing = await this.prisma.paymentWebhook.findFirst({ where: { propertyId, paymentProviderConfigId: configRecord.id, provider: configRecord.provider, idempotencyKey: scopedKey } });
    if (existing) return this.mapWebhook(existing);
    try {
      const record = await this.prisma.paymentWebhook.create({
        data: {
          id: generateUuidV7(), propertyId, paymentProviderConfigId: configRecord.id,
          provider: configRecord.provider, eventType: dto.eventType, payload: safePayload as Prisma.InputJsonValue,
          processed: false, correlationId: correlationId || webhook.correlationId || provider.generateIdempotencyKey(`correlation:${idempotencyKey}`),
          idempotencyKey: scopedKey, version: 0,
        },
      });
      return this.mapWebhook(record);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const duplicate = await this.prisma.paymentWebhook.findFirst({ where: { propertyId, paymentProviderConfigId: configRecord.id, provider: configRecord.provider, idempotencyKey: scopedKey } });
        if (duplicate) return this.mapWebhook(duplicate);
      }
      throw error;
    }
  }

  async generateReconciliation(propertyId: string, dto: GeneratePaymentReconciliationDto): Promise<PaymentReconciliationDto> {
    await this.findProviderConfigById(propertyId, dto.paymentProviderConfigId);
    if (this.reconciliationService) {
      const operations = await this.reconciliationService.listRecoverable(propertyId, dto.paymentProviderConfigId);
      return {
        id: generateUuidV7(), propertyId, paymentProviderConfigId: dto.paymentProviderConfigId,
        periodStart: dto.periodStart, periodEnd: dto.periodEnd,
        totalPayments: operations.filter((item) => item.operationType === 'CAPTURE').length,
        totalRefunds: operations.filter((item) => item.operationType === 'REFUND').length,
        matched: 0, pmsOnly: 0, providerOnly: 0,
        discrepancies: operations.map((item) => ({ type: 'STATUS_MISMATCH' as const, pmsPaymentId: item.gatewayTransactionId || undefined, providerPaymentId: item.providerReference || undefined, details: `${item.operationType} ${item.id}: ${item.state}; ${item.reconciliationReason || 'settlement verification pending'}` })),
        generatedAt: new Date().toISOString(),
      };
    }
    return {
      id: generateUuidV7(), propertyId, paymentProviderConfigId: dto.paymentProviderConfigId,
      periodStart: dto.periodStart, periodEnd: dto.periodEnd,
      totalPayments: 0, totalRefunds: 0, matched: 0, pmsOnly: 0, providerOnly: 0,
      discrepancies: [], generatedAt: new Date().toISOString(),
    };
  }

  private async requireEnabledDemoConfig(propertyId: string, id: string): Promise<any> {
    const config = await this.prisma.paymentProviderConfig.findFirst({ where: { id, propertyId, deletedAt: null } });
    if (!config) throw new NotFoundException(`Payment provider config '${id}' not found for property`);
    if (config.provider !== 'DEMO') throw new BadRequestException('Payment execution is disabled until this provider has an implemented adapter.');
    if (!config.enabled) throw new BadRequestException('Payment provider is disabled.');
    return config;
  }

  private async createOutboxEvent(propertyId: string, type: string, subject: string, data: Record<string, unknown>, correlationId: string): Promise<void> {
    const event = createCloudEvent({ type, source: `https://pms.enterprise-hms.com/properties/${propertyId}/payments/${subject}`, subject, propertyId, data });
    await this.prisma.outboxEvent.create({
      data: { id: event.id, specversion: event.specversion, type: event.type, source: event.source, subject: event.subject,
        propertyId, datacontenttype: event.datacontenttype, time: new Date(event.time), data: event.data as any, correlationId },
    });
  }

  private encryptLegacyConfiguration(catalog: any, configuration: Record<string, any>): Record<string, unknown> {
    const secretNames = new Set((catalog?.credentialSchema || []).filter((field: any) => field.secret).map((field: any) => field.name));
    const isSecretName = (key: string) => secretNames.has(key) || /secret|token|password|credential|private.?key|api.?key/i.test(key);
    const secrets: Record<string, string> = {};
    const publicFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(configuration || {})) {
      if (key === 'credentialVault' || key === 'publicCredentials') continue;
      if (isSecretName(key)) {
        if (typeof value !== 'string') throw new BadRequestException(`Credential '${key}' must be a string.`);
        secrets[key] = value;
      } else if (typeof value !== 'object' || value === null) publicFields[key] = value;
      else publicFields[key] = value;
    }
    const legacyPublicCredentials = configuration?.publicCredentials;
    if (legacyPublicCredentials && typeof legacyPublicCredentials === 'object' && !Array.isArray(legacyPublicCredentials)) {
      for (const [key, value] of Object.entries(legacyPublicCredentials as Record<string, unknown>)) {
        if (isSecretName(key)) {
          if (typeof value !== 'string') throw new BadRequestException(`Credential '${key}' must be a string.`);
          secrets[key] = value;
        } else publicFields[key] = value;
      }
    }
    return { ...publicFields, ...(Object.keys(secrets).length ? { credentialVault: this.credentialVault.encrypt(secrets) } : {}) };
  }

  private readWebhookSecret(configuration: Record<string, unknown>): string {
    const vault = configuration?.credentialVault;
    if (vault) return this.credentialVault.decrypt(vault).webhookSecret || '';
    // A legacy secret in plaintext cannot be used for authenticated callbacks. Force
    // migration through the encrypted configuration API instead of reading it.
    return '';
  }

  private decryptLegacyConfiguration(catalog: any, configuration: Record<string, unknown>, maskSecrets = false): Record<string, any> {
    if (!catalog || !configuration) return {};
    const secretNames = new Set<string>((catalog.credentialSchema || []).filter((field: any) => field.secret || field.name === 'webhookSecret').map((field: any) => field.name as string));
    const isSecretName = (key: string) => secretNames.has(key) || /secret|token|password|credential|private.?key|api.?key/i.test(key);
    let secrets: Record<string, string> = {};
    if (configuration.credentialVault) secrets = this.credentialVault.decrypt(configuration.credentialVault);
    else {
      const legacySecrets = Object.fromEntries(Object.entries(configuration).filter(([key, value]) => isSecretName(key) && typeof value === 'string')) as Record<string, string>;
      if (Object.keys(legacySecrets).length) secrets = legacySecrets;
    }
    const result: Record<string, any> = {};
    for (const field of catalog.credentialSchema || []) {
      const legacyValue = configuration[field.name];
      const value = field.secret
        ? secrets[field.name]
        : (field.name === 'webhookSecret' ? secrets[field.name] : legacyValue);
      if (typeof value !== 'string') continue;
      result[field.name] = maskSecrets && field.masked ? '••••••' : value;
    }
    // Include vault-only legacy secrets for internal adapter use; mask them in API responses.
    for (const [key, value] of Object.entries(secrets)) {
      if (result[key] === undefined && typeof value === 'string') result[key] = maskSecrets ? '••••••' : value;
    }
    // Historical `publicCredentials` are untrusted legacy data. Treat secret-like
    // keys as secrets and never return their plaintext. webhookSecret is vault-only.
    const publicCredentials = configuration.publicCredentials as Record<string, unknown> || {};
    for (const [key, value] of Object.entries(publicCredentials || {})) {
      if (typeof value !== 'string' || result[key] !== undefined) continue;
      if (isSecretName(key)) {
        result[key] = '••••••';
        continue;
      }
      if (!maskSecrets && !isSecretName(key)) result[key] = value;
    }
    return result;
  }

  private mapProviderConfig = (c: any): PaymentProviderConfigDto => ({
    id: c.id, propertyId: c.propertyId, provider: c.provider as PaymentProviderType,
    name: c.name, enabled: c.enabled,
    configuration: this.decryptLegacyConfiguration(this.catalog.get(c.provider), c.configuration as Record<string, unknown>, true),
    supportedCurrencies: c.supportedCurrencies as string[], lastSyncAt: c.lastSyncAt?.toISOString() || null,
    lastError: c.lastError, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
  });

  private mapPaymentGatewayTransactionIntent = (i: any): PaymentIntentDto => ({
    id: i.id, propertyId: i.propertyId, paymentProviderConfigId: i.paymentProviderConfigId,
    externalId: i.externalId, amount: i.amount, currency: i.currency, status: i.status as PaymentIntentStatus,
    description: i.description, metadata: i.metadata as Record<string, any>, clientSecret: i.clientSecret,
    captureMethod: i.captureMethod, confirmationMethod: i.confirmationMethod, lastError: i.lastError,
    createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt.toISOString(),
  });

  private mapPaymentGatewayTransaction = (p: any): PaymentGatewayTransactionDto => ({
    id: p.id, propertyId: p.propertyId, paymentProviderConfigId: p.paymentProviderConfigId,
    paymentIntentId: p.paymentIntentId, externalId: p.externalId, amount: p.amount, currency: p.currency,
    status: p.status as PaymentGatewayTransactionStatus, description: p.description,
    metadata: p.metadata as Record<string, any>, authorizationCode: p.authorizationCode,
    capturedAt: p.capturedAt?.toISOString() || null, refundedAmount: p.refundedAmount,
    reconciliationStatus: p.reconciliationStatus, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
  });

  private redactSensitivePayload(value: unknown, depth = 0): unknown {
    if (depth > 12) return '[TRUNCATED]';
    if (Array.isArray(value)) return value.slice(0, 100).map((entry) => this.redactSensitivePayload(entry, depth + 1));
    if (!value || typeof value !== 'object') return typeof value === 'string' ? value.slice(0, 4000) : value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 200).map(([key, entry]) => [
      key,
      /secret|token|password|credential|private.?key|authorization|api.?key/i.test(key)
        ? '[REDACTED]'
        : this.redactSensitivePayload(entry, depth + 1),
    ]));
  }

  private mapWebhook = (w: any): PaymentWebhookDto => ({
    id: w.id, propertyId: w.propertyId, paymentProviderConfigId: w.paymentProviderConfigId,
    provider: w.provider as PaymentProviderType, eventType: w.eventType, payload: this.redactSensitivePayload(w.payload) as Record<string, any>,
    processed: w.processed, processedAt: w.processedAt?.toISOString() || null, error: w.error,
    correlationId: w.correlationId, idempotencyKey: w.idempotencyKey, createdAt: w.createdAt.toISOString(),
  });
}
