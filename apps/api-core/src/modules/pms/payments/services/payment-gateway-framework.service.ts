import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { generateUuidV7 } from '@hms/shared';
import {
  PaymentGatewayConfigDto, PaymentGatewayConnectionTestDto, PaymentGatewayEnvironment,
  PaymentGatewayProviderCatalogItem, PaymentProviderType, SavePaymentGatewayConfigDto,
  UpdatePaymentGatewayConfigDto, SecurityContext,
} from '@hms/api-contracts';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PaymentGatewayCredentialVault } from './payment-gateway-credential-vault';
import { PaymentGatewayProviderRegistry } from './payment-gateway-registry';
import { DemoPaymentGatewayAdapter } from './demo-payment-gateway.adapter';

interface StoredCredentials { credentialVault?: unknown; publicCredentials?: Record<string, string>; }

@Injectable()
export class PaymentGatewayFrameworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PaymentGatewayProviderRegistry,
    private readonly vault: PaymentGatewayCredentialVault,
    private readonly demoAdapter: DemoPaymentGatewayAdapter,
  ) {}

  async listCatalog(propertyId: string): Promise<PaymentGatewayProviderCatalogItem[]> {
    const property = await this.getPropertyRegion(propertyId);
    return this.registry.list(property.country.code, property.currency);
  }

  async listConfigs(propertyId: string): Promise<PaymentGatewayConfigDto[]> {
    const rows = await this.prisma.paymentProviderConfig.findMany({
      where: { propertyId, deletedAt: null }, orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.mapConfig(row));
  }

  async createConfig(propertyId: string, dto: SavePaymentGatewayConfigDto, actor: SecurityContext): Promise<PaymentGatewayConfigDto> {
    const catalog = await this.requireSupportedProvider(propertyId, dto.providerCode, dto.supportedCurrencies);
    this.validateCredentials(catalog, dto.credentials);
    this.validateMethods(catalog, dto.enabledPaymentMethods);
    const config = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.paymentProviderConfig.updateMany({ where: { propertyId, isPrimary: true, deletedAt: null }, data: { isPrimary: false } });
      }
      return tx.paymentProviderConfig.create({
        data: {
          id: generateUuidV7(), propertyId, provider: dto.providerCode, name: catalog.displayName,
          enabled: false, configuration: this.storeCredentials(catalog, dto.credentials) as Prisma.InputJsonValue,
          supportedCurrencies: dto.supportedCurrencies, enabledPaymentMethods: dto.enabledPaymentMethods,
          environment: dto.environment, priority: dto.priority ?? 100, isPrimary: dto.isPrimary ?? false,
          integrationStatus: catalog.adapterStatus === 'DEMO_ADAPTER' ? 'DEMO_ADAPTER' : 'CONFIGURED', version: 0,
        },
      });
    });
    await this.audit(propertyId, actor.userId, 'Gateway configured', config.id, {
      providerCode: config.provider, environment: config.environment,
      credentialNames: catalog.credentialSchema.filter((f) => dto.credentials[f.name]).map((f) => f.name), credentialValuesOmitted: true,
    });
    return this.mapConfig(config);
  }

  async updateConfig(propertyId: string, id: string, dto: UpdatePaymentGatewayConfigDto, actor: SecurityContext): Promise<PaymentGatewayConfigDto> {
    const config = await this.findOwnedConfig(propertyId, id);
    const catalog = this.registry.get(config.provider);
    if (!catalog) throw new BadRequestException('Provider is not present in the current catalog.');
    const credentials = dto.credentials ? { ...this.readCredentials(config.configuration), ...dto.credentials } : this.readCredentials(config.configuration);
    this.validateCredentials(catalog, credentials);
    const currencies = dto.supportedCurrencies ?? config.supportedCurrencies;
    await this.requireSupportedProvider(propertyId, config.provider, currencies);
    if (dto.enabledPaymentMethods) this.validateMethods(catalog, dto.enabledPaymentMethods);

    const update: Prisma.PaymentProviderConfigUpdateInput = {
      ...(dto.environment && { environment: dto.environment }),
      ...(dto.supportedCurrencies && { supportedCurrencies: dto.supportedCurrencies }),
      ...(dto.enabledPaymentMethods && { enabledPaymentMethods: dto.enabledPaymentMethods }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.credentials && { configuration: this.storeCredentials(catalog, credentials) as Prisma.InputJsonValue }),
      ...(dto.enabled !== undefined && { enabled: dto.enabled && catalog.adapterStatus === 'DEMO_ADAPTER' }),
      ...((dto.credentials || dto.environment) && { integrationStatus: catalog.adapterStatus === 'DEMO_ADAPTER' ? 'DEMO_ADAPTER' : 'CONFIGURED' }),
      version: { increment: 1 },
    };
    let updated: any;
    if (dto.isPrimary === true) {
      updated = await this.prisma.$transaction(async (tx) => {
        await tx.paymentProviderConfig.updateMany({ where: { propertyId, isPrimary: true, deletedAt: null }, data: { isPrimary: false } });
        return tx.paymentProviderConfig.update({ where: { id }, data: { ...update, isPrimary: true } });
      });
    } else {
      updated = await this.prisma.paymentProviderConfig.update({ where: { id }, data: { ...update, ...(dto.isPrimary === false && { isPrimary: false }) } });
    }
    if (dto.enabled !== undefined) await this.audit(propertyId, actor.userId, dto.enabled ? 'Gateway enabled' : 'Gateway disabled', id, { enabled: updated.enabled, providerCode: config.provider, secretsOmitted: true });
    if (dto.isPrimary) await this.audit(propertyId, actor.userId, 'Primary gateway changed', id, { providerCode: config.provider });
    if (dto.credentials) await this.audit(propertyId, actor.userId, 'Gateway credentials updated', id, { credentialNames: Object.keys(dto.credentials), credentialValuesOmitted: true });
    return this.mapConfig(updated);
  }

  async setEnabled(propertyId: string, id: string, enabled: boolean, actor: SecurityContext): Promise<PaymentGatewayConfigDto> {
    const config = await this.findOwnedConfig(propertyId, id);
    const catalog = this.registry.get(config.provider);
    if (enabled && catalog?.adapterStatus !== 'DEMO_ADAPTER') throw new ConflictException('Provider has no verified adapter and cannot be enabled.');
    const updated = await this.prisma.paymentProviderConfig.update({
      where: { id }, data: { enabled, integrationStatus: enabled ? 'DEMO_ADAPTER' : 'DISABLED', ...(!enabled && { isPrimary: false }), version: { increment: 1 } },
    });
    await this.audit(propertyId, actor.userId, enabled ? 'Gateway enabled' : 'Gateway disabled', id, { enabled, providerCode: config.provider, secretsOmitted: true });
    return this.mapConfig(updated);
  }

  async testConnection(propertyId: string, id: string, actor: SecurityContext): Promise<PaymentGatewayConnectionTestDto> {
    const config = await this.findOwnedConfig(propertyId, id);
    const catalog = this.registry.get(config.provider);
    if (!catalog) throw new BadRequestException('Provider is not present in the current catalog.');
    const result = catalog.adapterStatus === 'DEMO_ADAPTER'
      ? await this.demoAdapter.testConnection({ environment: config.environment as PaymentGatewayEnvironment, credentials: this.readCredentials(config.configuration) })
      : { ok: false, status: 'CATALOG_ONLY' as const, message: 'No provider adapter is implemented; no network request was made.', testedAt: new Date().toISOString() };
    await this.prisma.paymentProviderConfig.update({ where: { id }, data: { integrationStatus: result.status, lastSyncAt: new Date(), lastError: result.ok ? null : result.message } });
    await this.audit(propertyId, actor.userId, 'Gateway connection test', id, { status: result.status, ok: result.ok, networkCalled: false, secretsOmitted: true });
    return result;
  }

  private async getPropertyRegion(propertyId: string): Promise<any> {
    const property = await this.prisma.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { currency: true, country: { select: { code: true } } } });
    if (!property) throw new NotFoundException('Property not found.');
    return property;
  }

  private async requireSupportedProvider(propertyId: string, code: PaymentProviderType, currencies: string[]): Promise<PaymentGatewayProviderCatalogItem> {
    const property = await this.getPropertyRegion(propertyId);
    const catalog = this.registry.get(code);
    if (!catalog || !catalog.supportedCountries.includes(property.country.code.toUpperCase())) throw new BadRequestException('Provider is unavailable in the property country.');
    const propertyCurrency = property.currency.toUpperCase();
    if (!catalog.supportedCurrencies.includes(propertyCurrency) || currencies.some((currency) => currency.toUpperCase() !== propertyCurrency)) {
      throw new BadRequestException('Provider or selected currencies do not support the property currency.');
    }
    return catalog;
  }

  private validateCredentials(catalog: PaymentGatewayProviderCatalogItem, credentials: Record<string, string>): void {
    for (const name of Object.keys(credentials)) if (!catalog.credentialSchema.some((field) => field.name === name)) throw new BadRequestException(`Credential field '${name}' is not defined for ${catalog.providerCode}.`);
    for (const field of catalog.credentialSchema) {
      const value = credentials[field.name];
      if (field.required && (!value || !value.trim())) throw new BadRequestException(`Credential '${field.label}' is required.`);
      if (!value) continue;
      if (field.validation?.pattern && !new RegExp(field.validation.pattern).test(value)) throw new BadRequestException(`Credential '${field.label}' is invalid.`);
      if (field.validation?.minLength && value.length < field.validation.minLength) throw new BadRequestException(`Credential '${field.label}' is too short.`);
      if (field.validation?.maxLength && value.length > field.validation.maxLength) throw new BadRequestException(`Credential '${field.label}' is too long.`);
    }
  }

  private validateMethods(catalog: PaymentGatewayProviderCatalogItem, methods: string[]): void {
    if (methods.some((method) => !catalog.supportedPaymentMethods.includes(method))) throw new BadRequestException('A selected payment method is not supported by this provider.');
  }

  private storeCredentials(catalog: PaymentGatewayProviderCatalogItem, credentials: Record<string, string>): StoredCredentials {
    const secretNames = new Set(catalog.credentialSchema.filter((f) => f.secret).map((f) => f.name));
    const secret: Record<string, string> = {}; const publicCredentials: Record<string, string> = {};
    for (const [key, value] of Object.entries(credentials)) (secretNames.has(key) ? secret : publicCredentials)[key] = value;
    return { ...(Object.keys(secret).length ? { credentialVault: this.vault.encrypt(secret) } : {}), publicCredentials };
  }

  private readCredentials(configuration: unknown): Record<string, string> {
    const stored = (configuration || {}) as StoredCredentials;
    return { ...(stored.credentialVault ? this.vault.decrypt(stored.credentialVault) : {}), ...(stored.publicCredentials || {}) };
  }

  private async findOwnedConfig(propertyId: string, id: string): Promise<any> {
    const config = await this.prisma.paymentProviderConfig.findFirst({ where: { id, propertyId, deletedAt: null } });
    if (!config) throw new NotFoundException(`Gateway configuration '${id}' not found for property.`);
    return config;
  }

  private mapConfig(config: any): PaymentGatewayConfigDto {
    const catalog = this.registry.get(config.provider);
    const credentials = this.readCredentials(config.configuration);
    return {
      id: config.id, propertyId: config.propertyId, providerCode: config.provider,
      displayName: catalog?.displayName || config.name, environment: config.environment,
      supportedCurrencies: config.supportedCurrencies, enabledPaymentMethods: config.enabledPaymentMethods,
      priority: config.priority, isPrimary: config.isPrimary, enabled: config.enabled,
      integrationStatus: config.integrationStatus,
      credentialFields: (catalog?.credentialSchema || []).map((field) => ({ name: field.name, configured: Boolean(credentials[field.name]), ...(field.masked && credentials[field.name] ? { maskedValue: '••••••' } : {}) })),
      createdAt: config.createdAt.toISOString(), updatedAt: config.updatedAt.toISOString(),
    };
  }

  private async audit(propertyId: string, actorId: string, action: string, id: string, metadata: Record<string, unknown>): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        id: generateUuidV7(), actorId, actorType: 'USER', action: 'CONFIGURE_INTEGRATION', outcome: 'SUCCESS',
        entityType: 'INTEGRATION', entityId: id, propertyId,
        after: { action, ...metadata } as Prisma.InputJsonValue, source: 'API',
        metadata: { subsystem: 'PAYMENT_GATEWAY', ...metadata } as Prisma.InputJsonValue, version: 0,
      },
    });
  }
}
