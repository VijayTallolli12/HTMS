import { createHash, createHmac, timingSafeEqual } from 'crypto';
import {
  AuthorizePaymentDto,
  CancelPaymentDto,
  CapturePaymentDto,
  CreatePaymentIntentDto,
  PaymentGatewayCapability,
  PaymentGatewayConnectionTestDto,
  PaymentGatewayEnvironment,
  PaymentGatewayProvider,
  PaymentGatewayTransactionDto,
  PaymentGatewayTransactionStatus,
  PaymentIntentStatus,
  PaymentProvider,
  PaymentProviderType,
  RefundPaymentDto,
} from '@hms/api-contracts';

export class DemoPaymentGatewayAdapter implements PaymentGatewayProvider, PaymentProvider {
  readonly providerCode: PaymentProviderType = 'DEMO';
  readonly provider: PaymentProviderType = 'DEMO';
  readonly capabilities: ReadonlySet<PaymentGatewayCapability> = new Set([
    'SALE', 'AUTHORIZE', 'CAPTURE', 'VOID', 'REFUND', 'PARTIAL_REFUND', 'PAYMENT_STATUS', 'TOKENIZATION', 'WEBHOOKS',
  ]);

  async configure(_config: Record<string, any>): Promise<void> {
    // Deliberately accepts simulation configuration only. No sockets or HTTP clients are used.
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: unknown }> {
    return { healthy: true, details: { simulated: true, networkCalls: 0 } };
  }

  async createPaymentIntent(data: CreatePaymentIntentDto): Promise<{ externalId: string; clientSecret?: string; status: PaymentIntentStatus }> {
    const reference = this.reference('INTENT', data.idempotencyKey || JSON.stringify(data));
    return { externalId: `DEMO-${reference}`, clientSecret: `demo_${reference}`, status: 'REQUIRES_PAYMENT_METHOD' };
  }

  async authorizePayment(data: AuthorizePaymentDto): Promise<{ externalId: string; status: PaymentIntentStatus; authorizationCode?: string }> {
    const reference = this.reference('AUTH', `${data.paymentIntentId}:${data.idempotencyKey || ''}`);
    return { externalId: `DEMO-${reference}`, status: 'SUCCEEDED', authorizationCode: `AUTH-${reference.slice(-10)}` };
  }

  async capturePayment(data: CapturePaymentDto): Promise<{ externalId: string; status: PaymentGatewayTransactionStatus; capturedAt: string }> {
    return { externalId: `DEMO-CAP-${this.reference('CAPTURE', data.idempotencyKey || data.paymentId)}`, status: 'CAPTURED', capturedAt: new Date().toISOString() };
  }

  async refundPayment(data: RefundPaymentDto): Promise<{ externalId: string; status: PaymentGatewayTransactionStatus; refundedAt: string }> {
    return { externalId: `DEMO-REF-${this.reference('REFUND', data.idempotencyKey || data.paymentId)}`, status: 'REFUNDED', refundedAt: new Date().toISOString() };
  }

  async cancelPayment(data: CancelPaymentDto): Promise<{ externalId: string; status: PaymentIntentStatus }> {
    return { externalId: `DEMO-CANCEL-${this.reference('CANCEL', data.idempotencyKey || data.paymentIntentId)}`, status: 'CANCELLED' };
  }

  async getPayment(externalId: string): Promise<PaymentGatewayTransactionDto | null> {
    return externalId.startsWith('DEMO-') ? null : null;
  }

  parseWebhook(payload: Record<string, any>): any {
    const idempotencyKey = typeof payload.eventId === 'string' ? payload.eventId : undefined;
    return {
      id: '', propertyId: '', paymentProviderConfigId: '', provider: 'DEMO',
      eventType: String(payload.eventType || 'demo.event'), payload, processed: false,
      processedAt: null, error: null, correlationId: typeof payload.correlationId === 'string' ? payload.correlationId : null,
      idempotencyKey: idempotencyKey || '', createdAt: new Date().toISOString(),
    };
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!secret || !signature) return false;
    const expected = createHmac('sha256', secret).update(payload).digest();
    let supplied: Buffer;
    try { supplied = Buffer.from(signature, 'hex'); } catch { return false; }
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  generateIdempotencyKey(prefix: string): string {
    return this.reference('IDEM', prefix);
  }

  async testConnection(input: {
    environment: PaymentGatewayEnvironment;
    credentials: Readonly<Record<string, string>>;
  }): Promise<PaymentGatewayConnectionTestDto> {
    return {
      ok: true,
      status: 'DEMO_ADAPTER',
      message: input.environment === 'PRODUCTION'
        ? 'Demo mode remains simulated; this is not a production connection.'
        : 'Deterministic simulated connection check passed; no network request was made.',
      testedAt: new Date().toISOString(),
    };
  }

  async sale(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.result('SALE', input);
  }

  async authorize(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.result('AUTHORIZED', input);
  }

  async capture(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.result('CAPTURED', input);
  }

  async void(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.result('VOIDED', input);
  }

  async refund(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.result('REFUNDED', input);
  }

  async paymentStatus(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.result('PAYMENT_STATUS', input);
  }

  async tokenize(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.result('TOKENIZED', input);
  }

  verifyWebhook(rawBody: Buffer, signature: string, credentials: Readonly<Record<string, string>>): boolean {
    return this.verifyWebhookSignature(rawBody.toString('utf8'), signature, credentials.webhookSecret || '');
  }

  private result(action: string, input: Record<string, unknown>): Record<string, unknown> {
    return { simulated: true, action, reference: `DEMO-${this.reference(action, JSON.stringify(input))}` };
  }

  private reference(action: string, value: string): string {
    return createHash('sha256').update(`${action}:${value}`).digest('hex').slice(0, 20);
  }
}
