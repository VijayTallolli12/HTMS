import { PaymentGatewayCredentialVault } from '../../apps/api-core/src/modules/pms/payments/services/payment-gateway-credential-vault';
import { PaymentGatewayProviderRegistry, deriveGatewayStatus } from '../../apps/api-core/src/modules/pms/payments/services/payment-gateway-registry';
import { DemoPaymentGatewayAdapter } from '../../apps/api-core/src/modules/pms/payments/services/demo-payment-gateway.adapter';
import { PaymentGatewayFrameworkService } from '../../apps/api-core/src/modules/pms/payments/services/payment-gateway-framework.service';
import { PaymentGatewayService } from '../../apps/api-core/src/modules/pms/payments/services/payment-gateway.service';

describe('Payment gateway provider framework', () => {
  describe('provider catalog', () => {
    const registry = new PaymentGatewayProviderRegistry();

    it('filters provider catalog by country and currency without activating providers', () => {
      const saProviders = registry.list('SA', 'SAR');
      expect(saProviders.map((provider) => provider.providerCode)).toContain('HYPERPAY');
      expect(saProviders.some((provider) => provider.providerCode === 'TELR')).toBe(false);
      expect(saProviders.every((provider) => provider.integrationStatus !== 'CONNECTED')).toBe(true);
    });

    it('resolves eligible providers for a Japan/JPY property (regression: previously 0 providers)', () => {
      const jpProviders = registry.list('JP', 'JPY').map((provider) => provider.providerCode);
      expect(jpProviders).toContain('DEMO');
      expect(jpProviders).toContain('GMO_PAYMENT_GATEWAY');
      expect(jpProviders).toContain('SB_PAYMENT_SERVICE');
      expect(jpProviders).toContain('STRIPE');
      expect(jpProviders.length).toBeGreaterThan(0);
      // A Japan-only domestic provider must never surface for a UAE property.
      expect(registry.list('AE', 'AED').map((p) => p.providerCode)).not.toContain('GMO_PAYMENT_GATEWAY');
    });

    it('derives non-MENA supported currencies and local payment methods per country', () => {
      expect(registry.get('DEMO')?.supportedCurrencies).toContain('JPY');
      expect(registry.get('STRIPE')?.supportedCurrencies).toEqual(expect.arrayContaining(['JPY', 'USD', 'GBP', 'INR']));
      expect(registry.get('DEMO')?.countryPaymentMethods.JP).toContain('JCB');
      expect(registry.get('DEMO')?.countryPaymentMethods.IN).toContain('UPI');
      expect(registry.get('GMO_PAYMENT_GATEWAY')?.countryPaymentMethods.JP).toContain('KONBINI');
    });

    it('describes MENA-local payment methods by region', () => {
      expect(registry.get('DEMO')?.countryPaymentMethods.AE).toContain('JAYWAN');
      expect(registry.get('DEMO')?.countryPaymentMethods.SA).toContain('MADA');
      expect(registry.get('DEMO')?.countryPaymentMethods.KW).toContain('KNET');
      expect(registry.get('DEMO')?.countryPaymentMethods.QA).toContain('NAPS');
      expect(registry.get('DEMO')?.countryPaymentMethods.OM).toContain('OMANNET');
      expect(registry.get('DEMO')?.countryPaymentMethods.BH).toContain('BENEFIT');
    });

    it('marks third-party catalog entries catalog-only with no capabilities', () => {
      const provider = registry.get('CHECKOUT_COM');
      expect(provider?.adapterStatus).toBe('CATALOG_ONLY');
      expect(provider?.capabilities).toEqual([]);
      expect(provider?.productionSupport).toBe(true);
    });

    it('distinguishes catalog, demo, configured and verified statuses', () => {
      expect(deriveGatewayStatus({ adapterStatus: 'CATALOG_ONLY', enabled: true })).toBe('CATALOG_ONLY');
      expect(deriveGatewayStatus({ adapterStatus: 'DEMO_ADAPTER', enabled: true })).toBe('DEMO_ADAPTER');
      expect(deriveGatewayStatus({ adapterStatus: 'SANDBOX_READY', enabled: true })).toBe('CONFIGURED');
      expect(deriveGatewayStatus({ adapterStatus: 'SANDBOX_READY', enabled: true, testPassed: true, environment: 'PRODUCTION' })).toBe('CONNECTED');
    });
  });

  describe('credential vault', () => {
    const previous = process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;
    const vault = new PaymentGatewayCredentialVault();
    beforeEach(() => { process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = 'unit-test-only-key-with-32-chars-minimum'; });
    afterAll(() => {
      if (previous === undefined) delete process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;
      else process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = previous;
    });

    it('encrypts and decrypts credential values without persisting plaintext', () => {
      const encrypted = vault.encrypt({ secretKey: 'never-return-this' });
      expect(JSON.stringify(encrypted)).not.toContain('never-return-this');
      expect(vault.decrypt(encrypted)).toEqual({ secretKey: 'never-return-this' });
    });

    it('masks legacy publicCredentials and webhookSecret from provider configuration APIs', async () => {
      const prisma: any = {
        paymentProviderConfig: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'config-1', propertyId: 'property-A', provider: 'DEMO', name: 'Demo', enabled: false,
            configuration: { webhookSecret: 'legacy-webhook-plaintext', publicCredentials: { accessToken: 'legacy-token-plaintext', demoLabel: 'training' } },
            supportedCurrencies: ['USD'], createdAt: new Date(), updatedAt: new Date(),
          }),
        },
      };
      const service = new PaymentGatewayService(prisma);
      const dto = await service.findProviderConfigById('property-A', 'config-1');
      const serialized = JSON.stringify(dto.configuration);
      expect(serialized).not.toContain('legacy-webhook-plaintext');
      expect(serialized).not.toContain('legacy-token-plaintext');
      expect(serialized).toContain('••••••');
    });

    it('encrypts arbitrary secret-shaped legacy fields and never puts values in audit/output', async () => {
      const previous = process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;
      process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = 'unit-test-only-key-with-32-chars-minimum';
      const prisma: any = {
        paymentProviderConfig: { create: jest.fn().mockImplementation(({ data }) => ({ ...data, createdAt: new Date(), updatedAt: new Date() })) },
        outboxEvent: { create: jest.fn() },
      };
      try {
        const service = new PaymentGatewayService(prisma);
        const dto = await service.createProviderConfig('property-A', {
          provider: 'DEMO', name: 'Demo', configuration: { webhookSecret: 'value-not-audit', privateKey: 'also-secret', publicCredentials: { bearerToken: 'token-secret' } },
        } as any);
        expect(JSON.stringify(prisma.paymentProviderConfig.create.mock.calls[0][0].data.configuration)).not.toContain('value-not-audit');
        expect(JSON.stringify(prisma.paymentProviderConfig.create.mock.calls[0][0].data.configuration)).not.toContain('also-secret');
        expect(JSON.stringify(dto.configuration)).not.toContain('value-not-audit');
        expect(JSON.stringify(dto.configuration)).not.toContain('token-secret');
      } finally {
        if (previous === undefined) delete process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;
        else process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = previous;
      }
    });

    it('fails closed when the deployment encryption key is absent', () => {
      delete process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;
      expect(() => vault.encrypt({ secretKey: 'value' })).toThrow();
      process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = 'unit-test-only-key-with-32-chars-minimum';
    });
  });

  describe('demo adapter', () => {
    const adapter = new DemoPaymentGatewayAdapter();
    it('is deterministic and never reports live connectivity', async () => {
      const a = await adapter.sale({ idempotencyKey: 'stable' });
      const b = await adapter.sale({ idempotencyKey: 'stable' });
      expect(a).toEqual(b);
      expect(a.simulated).toBe(true);
      const test = await adapter.testConnection({ environment: 'PRODUCTION', credentials: {} });
      expect(test.status).toBe('DEMO_ADAPTER');
      expect(test.ok).toBe(true);
      expect(test.message).toContain('not a production connection');
    });

    it('verifies webhook signatures and rejects absent or invalid signatures', () => {
      const raw = Buffer.from('{"event":"demo"}');
      expect(adapter.verifyWebhook(raw, 'bad', { webhookSecret: 'secret' })).toBe(false);
      expect(adapter.verifyWebhook(raw, 'valid', {})).toBe(false);
    });
  });

  describe('legacy payment safety boundaries', () => {
    it('registers only the deterministic DEMO provider; real-provider calls cannot be made by catalog entries', () => {
      const service = new PaymentGatewayService({} as any);
      expect(service.getProvider('DEMO')).toBeDefined();
      expect(service.getProvider('STRIPE')).toBeUndefined();
      expect(service.getProvider('AMAZON_PAYMENT_SERVICES')).toBeUndefined();
    });

    it('property-isolates framework configuration lookups', async () => {
      const prisma = {
        paymentProviderConfig: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;
      const framework = new PaymentGatewayFrameworkService(
        prisma,
        new PaymentGatewayProviderRegistry(),
        new PaymentGatewayCredentialVault(),
        new DemoPaymentGatewayAdapter(),
      );
      await expect((framework as any).findOwnedConfig('property-A', 'gateway-B')).rejects.toThrow();
      expect(prisma.paymentProviderConfig.findFirst).toHaveBeenCalledWith({ where: { id: 'gateway-B', propertyId: 'property-A', deletedAt: null } });
    });
  });
});
