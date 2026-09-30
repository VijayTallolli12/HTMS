import { PaymentGatewayService } from '../../apps/api-core/src/modules/pms/payments/services/payment-gateway.service';
import { PaymentGatewayCredentialVault } from '../../apps/api-core/src/modules/pms/payments/services/payment-gateway-credential-vault';
import { createHmac, createHash } from 'crypto';

const propertyAConfig = {
  id: 'gateway-001', propertyId: 'property-A', provider: 'DEMO',
  configuration: {}, enabled: true, deletedAt: null,
};

describe('Payment gateway webhook safety', () => {
  const encryptionKey = 'test-encryption-key-with-32-chars-minimum';
  const previousKey = process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;
  beforeAll(() => { process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = encryptionKey; });
  afterAll(() => {
    if (previousKey === undefined) delete process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;
    else process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = previousKey;
  });

  function setup(config = propertyAConfig) {
    const prisma: any = {
      paymentProviderConfig: { findFirst: jest.fn().mockImplementation(async ({ where }: any) => config.propertyId === where.propertyId && config.id === where.id ? config : null) },
      paymentWebhook: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, createdAt: new Date(), processedAt: null })) },
    };
    return { service: new PaymentGatewayService(prisma), prisma };
  }

  const request = (eventId: string) => {
    const payload = { eventId, eventType: 'payment.succeeded', metadata: { accessToken: 'do-not-leak' } };
    const signedRequest = { paymentProviderConfigId: 'gateway-001', eventType: payload.eventType, payload };
    const body = Buffer.from(JSON.stringify(signedRequest));
    const signature = createHmac('sha256', 'secret').update(body).digest('hex');
    return { payload, body, signature };
  };

  function encryptedConfig() {
    const vault = new PaymentGatewayCredentialVault();
    return { ...propertyAConfig, configuration: { credentialVault: vault.encrypt({ webhookSecret: 'secret' }) } };
  }

  it('requires a valid provider signature before webhook persistence', async () => {
    const { service, prisma } = setup(encryptedConfig());
    const { payload, body } = request('evt-1');
    await expect(service.processWebhook('property-A', { paymentProviderConfigId: 'gateway-001', eventType: payload.eventType, payload } as any, undefined, undefined, body)).rejects.toThrow('signature verification failed');
    expect(prisma.paymentWebhook.create).not.toHaveBeenCalled();
  });

  it('uses scoped idempotency including property and configuration, and redacts payload secrets', async () => {
    const { service, prisma } = setup(encryptedConfig());
    const { payload, body, signature } = request('evt-42');
    const result = await service.processWebhook('property-A', { paymentProviderConfigId: 'gateway-001', eventType: payload.eventType, payload } as any, signature, 'corr-A', body);
    expect(prisma.paymentProviderConfig.findFirst).toHaveBeenCalledWith({ where: { id: 'gateway-001', propertyId: 'property-A', deletedAt: null } });
    const created = prisma.paymentWebhook.create.mock.calls[0][0].data;
    const expected = createHash('sha256').update('property-A:gateway-001:DEMO:evt-42').digest('hex');
    expect(created.idempotencyKey).toBe(expected);
    expect(result.payload.metadata.accessToken).toBe('[REDACTED]');
    expect(JSON.stringify(result)).not.toContain('do-not-leak');
  });

  it('deduplicates the same webhook identity within a property and config', async () => {
    const { service, prisma } = setup(encryptedConfig());
    const { payload, body, signature } = request('evt-duplicate');
    const existing = { id: 'saved', propertyId: 'property-A', paymentProviderConfigId: 'gateway-001', provider: 'DEMO', eventType: payload.eventType, payload, processed: false, processedAt: null, error: null, correlationId: 'c', idempotencyKey: 'scoped', createdAt: new Date() };
    prisma.paymentWebhook.findFirst.mockResolvedValue(existing);
    const result = await service.processWebhook('property-A', { paymentProviderConfigId: 'gateway-001', eventType: payload.eventType, payload } as any, signature, 'c', body);
    expect(result.id).toBe('saved');
    expect(prisma.paymentWebhook.create).not.toHaveBeenCalled();
  });

  it('does not resolve a property-A event through a property-B gateway config', async () => {
    const { service, prisma } = setup({ ...encryptedConfig(), propertyId: 'property-A' });
    const { payload, body, signature } = request('evt-cross-property');
    await expect(service.processWebhook('property-B', { paymentProviderConfigId: 'gateway-001', eventType: payload.eventType, payload } as any, signature, undefined, body)).rejects.toThrow();
    expect(prisma.paymentWebhook.create).not.toHaveBeenCalled();
  });
});
