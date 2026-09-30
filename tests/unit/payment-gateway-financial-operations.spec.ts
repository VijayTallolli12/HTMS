import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentMethod } from '@hms/api-contracts';
import { PaymentGatewayFinancialOperationsService } from '../../apps/api-core/src/modules/pms/payments/services/payment-gateway-financial-operations.service';
import { PaymentGatewayProviderRegistry } from '../../apps/api-core/src/modules/pms/payments/services/payment-gateway-registry';
import { DemoPaymentGatewayAdapter } from '../../apps/api-core/src/modules/pms/payments/services/demo-payment-gateway.adapter';
import { computeChargePayloadHash, computePaymentPayloadHash } from '../../apps/api-core/src/modules/pms/finance/services/folio.service';

const propertyId = 'property-A';
const actor: any = {
  userId: 'user-1', sessionId: 'session-1', correlationId: 'corr-1',
  user: { id: 'user-1', email: 'test@example.invalid', firstName: 'Test', lastName: 'User', status: 'ACTIVE' },
  roles: [], scopes: [], permissions: new Set(), isGlobalAdmin: false,
  activeContext: { hotelGroupId: 'group-1', propertyId },
};

function setup(options: { operation?: Record<string, any>; folioStatus?: string; reservationStatus?: string; balance?: string } = {}) {
  const payment: any = {
    id: 'gateway-1', propertyId, paymentProviderConfigId: 'config-1', paymentIntentId: 'intent-1', deletedAt: null,
    externalId: 'ext-1', amount: 1000, authorizedAmount: 1000, capturedAmount: 0,
    pendingCaptureAmount: 0, pendingRefundAmount: 0, refundedAmount: 0, currency: 'USD', status: 'AUTHORIZED',
  };
  const folio: any = { id: 'folio-1', propertyId, reservationId: 'reservation-1', status: options.folioStatus || 'OPEN', currency: 'USD', balance: options.balance || '20.0000' };
  const reservation: any = { id: 'reservation-1', propertyId, status: options.reservationStatus || 'CHECKED_IN' };
  const intent: any = { id: 'intent-1', propertyId, paymentProviderConfigId: 'config-1', folioId: 'folio-1', externalId: 'intent-ext', amount: 1000, currency: 'USD', status: 'PROCESSING', version: 0 };
  const operations: any[] = [];
  const payments: any[] = [];
  const transactions: any[] = [];
  const adjustments: any[] = [];
  const initialOperation: any = {
    id: 'op-1', propertyId, paymentProviderConfigId: 'config-1', paymentIntentId: 'intent-1',
    gatewayTransactionId: 'gateway-1', folioId: 'folio-1', reservationId: 'reservation-1',
    originalPaymentId: 'folio-payment-1', operationType: 'CAPTURE', idempotencyKey: 'capture-1',
    requestHash: '', amount: 500, currency: 'USD', providerIdempotencyKey: 'pgop:op-1',
    actorId: actor.userId, actorHotelGroupId: actor.activeContext.hotelGroupId,
    actorSnapshot: { user: actor.user, roles: [], scopes: [], permissions: [], isGlobalAdmin: false },
    state: 'REQUESTED', providerConfirmedAt: null, transactionAppliedAt: null, folioPaymentId: null,
    folioTransactionId: null, providerReference: null, providerResult: null, reason: null,
    ...options.operation,
  };
  const matches = (row: any, where: any = {}) => Object.entries(where).every(([key, expected]: [string, any]) => {
    if (!expected || typeof expected !== 'object' || Array.isArray(expected)) return row[key] === expected;
    if ('in' in expected && !expected.in.includes(row[key])) return false;
    if ('not' in expected && (expected.not === null ? row[key] == null : row[key] === expected.not)) return false;
    if ('gte' in expected && row[key] < expected.gte) return false;
    if ('lte' in expected && row[key] > expected.lte) return false;
    return true;
  });
  const updateData = (row: any, data: any) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'increment' in value) row[key] = (row[key] || 0) + (value as any).increment;
      else if (value && typeof value === 'object' && 'decrement' in value) row[key] = (row[key] || 0) - (value as any).decrement;
      else row[key] = value;
    }
  };
  const prisma: any = {
    paymentIntent: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any = {}) => matches(intent, where) ? intent : null),
      updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
        if (!matches(intent, where)) return { count: 0 };
        updateData(intent, data);
        return { count: 1 };
      }),
    },
    paymentGatewayTransaction: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any = {}) => matches(payment, where) ? payment : null),
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockImplementation(async ({ data, where }: any) => {
        if (!matches(payment, where)) return { count: 0 };
        updateData(payment, data);
        return { count: 1 };
      }),
    },
    paymentGatewayOperation: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any = {}) => operations.find((row) => matches(row, where)) || null),
      findUnique: jest.fn().mockImplementation(async ({ where }: any = {}) => operations.find((row) => row.id === where?.id) || null),
      findMany: jest.fn().mockImplementation(async ({ where }: any = {}) => operations.filter((row) => matches(row, where))),
      create: jest.fn().mockImplementation(async ({ data }: any) => { const row = { ...data, providerConfirmedAt: null, transactionAppliedAt: null }; operations.push(row); return row; }),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => { const row = operations.find((item) => item.id === where.id); if (!row) throw new Error('operation missing'); updateData(row, data); return row; }),
      updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const rows = operations.filter((row) => matches(row, where));
        rows.forEach((row) => updateData(row, data));
        return { count: rows.length };
      }),
    },
    paymentProviderConfig: { findFirst: jest.fn().mockResolvedValue({ id: 'config-1', propertyId, provider: 'DEMO', enabled: true }) },
    payment: {
      findMany: jest.fn().mockImplementation(async ({ where }: any = {}) => payments.filter((row) => matches(row, where))),
      findFirst: jest.fn().mockImplementation(async ({ where }: any = {}) => payments.find((row) => matches(row, where)) || null),
      findUnique: jest.fn().mockImplementation(async ({ where }: any = {}) => {
        if (where?.uq_payment_property_idempotency) return payments.find((row) => row.idempotencyKey === where.uq_payment_property_idempotency.idempotencyKey) || null;
        return payments.find((row) => row.id === where?.id) || null;
      }),
    },
    folio: { findFirst: jest.fn().mockImplementation(async ({ where }: any = {}) => where?.id && where.id !== folio.id ? null : folio) },
    reservation: { findFirst: jest.fn().mockImplementation(async () => reservation) },
    folioTransaction: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any = {}) => transactions.find((row) => matches(row, where)) || null),
      findUnique: jest.fn().mockImplementation(async ({ where }: any = {}) => transactions.find((row) => row.idempotencyKey === where?.uq_folio_tx_property_idempotency?.idempotencyKey) || null),
    },
    paymentAdjustment: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any = {}) => adjustments.find((row) => matches(row, where)) || null),
      create: jest.fn().mockImplementation(async ({ data }: any) => { const row = { id: `adjustment-${adjustments.length + 1}`, ...data }; adjustments.push(row); return row; }),
    },
  };
  const transaction = async (callback: any) => callback({
    paymentGatewayTransaction: prisma.paymentGatewayTransaction,
    paymentGatewayOperation: prisma.paymentGatewayOperation,
    paymentIntent: prisma.paymentIntent,
    paymentAdjustment: prisma.paymentAdjustment,
    $executeRaw: jest.fn().mockImplementation(async (query: any) => {
      const sql = `${query?.sql || ''} ${query?.strings?.join('') || ''}`;
      const values = query?.values || [];
      const amount = [...values].reverse().find((value: unknown) => typeof value === 'number') || 0;
      if (sql.includes('pending_refund_amount')) {
        if (payment.capturedAmount - payment.refundedAmount - payment.pendingRefundAmount < amount) return 0;
        payment.pendingRefundAmount += amount;
      } else {
        const authorized = payment.authorizedAmount || payment.amount;
        if (authorized - payment.capturedAmount - payment.pendingCaptureAmount < amount) return 0;
        payment.authorizedAmount = authorized;
        payment.pendingCaptureAmount += amount;
      }
      return 1;
    }),
  });
  prisma.$transaction = jest.fn().mockImplementation(transaction);

  const folioService: any = {
    recordPayment: jest.fn().mockImplementation(async (_propertyId: string, folioId: string, dto: any, _actor: any, idempotencyKey: string) => {
      const existing = payments.find((row) => row.idempotencyKey === idempotencyKey);
      if (existing) return existing;
      const row = { id: `folio-payment-${payments.length + 1}`, folioId, propertyId, amount: dto.amount, currency: 'USD', payloadHash: computePaymentPayloadHash(folioId, dto), idempotencyKey };
      payments.push(row);
      folio.balance = (Number(folio.balance) - Number(dto.amount)).toFixed(4);
      return row;
    }),
    postCharge: jest.fn().mockImplementation(async (_propertyId: string, folioId: string, dto: any, _actor: any, idempotencyKey: string) => {
      const existing = transactions.find((row) => row.idempotencyKey === idempotencyKey);
      if (existing) return existing;
      const row = { id: `folio-tx-${transactions.length + 1}`, folioId, propertyId, payloadHash: computeChargePayloadHash(folioId, dto), idempotencyKey };
      transactions.push(row);
      folio.balance = (Number(folio.balance) + Number(dto.amount)).toFixed(4);
      return row;
    }),
  };
  const adapter = new DemoPaymentGatewayAdapter();
  const service = new PaymentGatewayFinancialOperationsService(prisma, folioService, adapter, new PaymentGatewayProviderRegistry());
  return { service, prisma, folioService, adapter, payment, folio, operations, payments, transactions, adjustments, initialOperation };
}

describe('payment gateway durable operations', () => {
  it('captures and settles through FolioService with a deterministic operation key', async () => {
    const { service, folioService, prisma, operations } = setup();
    const result = await service.capture(propertyId, { paymentId: 'gateway-1', amount: 500, idempotencyKey: 'cap-a' } as any, actor);
    expect(folioService.recordPayment).toHaveBeenCalledWith(propertyId, 'folio-1', expect.objectContaining({ amount: '5.0000', paymentMethod: PaymentMethod.CREDIT_CARD }), expect.any(Object), expect.stringMatching(/^gateway-payment:/));
    expect(result.id).toBe('gateway-1');
    expect(operations[0].state).toBe('SETTLED');
    expect(prisma.paymentGatewayTransaction.updateMany).toHaveBeenCalled();
  });

  it('rejects captures above remaining authorization before provider invocation', async () => {
    const { service, prisma, adapter } = setup();
    const provider = jest.spyOn(adapter, 'capturePayment');
    await expect(service.capture(propertyId, { paymentId: 'gateway-1', amount: 1001, idempotencyKey: 'too-much' } as any, actor)).rejects.toThrow(BadRequestException);
    expect(provider).not.toHaveBeenCalled();
  });

  it('allows sequential partial captures as separate operations, then rejects over-capture', async () => {
    const { service, operations } = setup({ balance: '20.0000' });
    await service.capture(propertyId, { paymentId: 'gateway-1', amount: 300, idempotencyKey: 'partial-a' } as any, actor);
    await service.capture(propertyId, { paymentId: 'gateway-1', amount: 700, idempotencyKey: 'partial-b' } as any, actor);
    expect(operations).toHaveLength(2);
    expect(operations.map((item) => item.amount)).toEqual([300, 700]);
    await expect(service.capture(propertyId, { paymentId: 'gateway-1', amount: 1, idempotencyKey: 'too-much' } as any, actor)).rejects.toThrow(BadRequestException);
  });

  it('returns the prior settled operation on duplicate capture without another provider call', async () => {
    const { service, adapter, operations } = setup();
    const provider = jest.spyOn(adapter, 'capturePayment');
    await service.capture(propertyId, { paymentId: 'gateway-1', amount: 500, idempotencyKey: 'same-capture' } as any, actor);
    await service.capture(propertyId, { paymentId: 'gateway-1', amount: 500, idempotencyKey: 'same-capture' } as any, actor);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(operations).toHaveLength(1);
  });

  it('records a late confirmed capture for reconciliation without changing a closed Folio', async () => {
    const { service, folioService, payment, folio, operations } = setup({ folioStatus: 'CLOSED' });
    await expect(service.capture(propertyId, { paymentId: 'gateway-1', amount: 500, idempotencyKey: 'late-capture' } as any, actor)).rejects.toThrow(ConflictException);
    expect(payment.capturedAmount).toBe(500);
    expect(payment.pendingCaptureAmount).toBe(0);
    expect(folio.balance).toBe('20.0000');
    expect(folioService.recordPayment).not.toHaveBeenCalled();
    expect(operations[0].state).toBe('REQUIRES_RECONCILIATION');
    expect(operations[0].failureCode).toBe('FOLIO_CLOSED_AFTER_CAPTURE');
  });

  it('does not settle a capture when the reservation is no longer checked in', async () => {
    const { service, folioService, payment, operations } = setup({ reservationStatus: 'CHECKED_OUT' });
    await expect(service.capture(propertyId, { paymentId: 'gateway-1', amount: 500, idempotencyKey: 'not-checked-in' } as any, actor)).rejects.toThrow(ConflictException);
    expect(payment.capturedAmount).toBe(500);
    expect(folioService.recordPayment).not.toHaveBeenCalled();
    expect(operations[0].reconciliationReason).toContain('CHECKED_IN');
  });

  it('retains a capture reservation and never retries an unknown provider outcome', async () => {
    const { service, adapter, payment } = setup();
    const provider = jest.spyOn(adapter, 'capturePayment').mockRejectedValue(new Error('provider timeout'));
    const dto = { paymentId: 'gateway-1', amount: 500, idempotencyKey: 'capture-timeout' } as any;
    await expect(service.capture(propertyId, dto, actor)).rejects.toThrow('provider timeout');
    expect(payment.pendingCaptureAmount).toBe(500);
    await expect(service.capture(propertyId, dto, actor)).rejects.toThrow(ConflictException);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('creates a distinct append-only Folio credit for each active-Folio refund', async () => {
    const { service, folioService, operations, transactions, payment, folio } = setup();
    await service.capture(propertyId, { paymentId: 'gateway-1', amount: 500, idempotencyKey: 'capture-for-refunds' } as any, actor);
    const originalPaymentId = operations[0].folioPaymentId;
    await service.refund(propertyId, { paymentId: 'gateway-1', originalPaymentId, amount: 200, reason: 'Partial refund one', idempotencyKey: 'refund-one' } as any, actor);
    await service.refund(propertyId, { paymentId: 'gateway-1', originalPaymentId, amount: 100, reason: 'Partial refund two', idempotencyKey: 'refund-two' } as any, actor);
    const refunds = operations.filter((operation) => operation.operationType === 'REFUND');
    expect(refunds).toHaveLength(2);
    expect(new Set(refunds.map((operation) => operation.id)).size).toBe(2);
    expect(new Set(refunds.map((operation) => operation.providerIdempotencyKey)).size).toBe(2);
    expect(transactions).toHaveLength(2);
    expect(folioService.postCharge).toHaveBeenCalledTimes(2);
    expect(transactions.map((entry) => entry.payloadHash)).toHaveLength(2);
    expect(folio.balance).toBe('18.0000');
    expect(payment.refundedAmount).toBe(300);
  });

  it('returns a duplicate settled refund without another provider call', async () => {
    const { service, adapter, operations } = setup();
    await service.capture(propertyId, { paymentId: 'gateway-1', amount: 500, idempotencyKey: 'capture-duplicate-refund' } as any, actor);
    const originalPaymentId = operations[0].folioPaymentId;
    const provider = jest.spyOn(adapter, 'refundPayment');
    const dto = { paymentId: 'gateway-1', originalPaymentId, amount: 200, reason: 'Duplicate test', idempotencyKey: 'same-refund' } as any;
    await service.refund(propertyId, dto, actor);
    await service.refund(propertyId, dto, actor);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(operations.filter((operation) => operation.operationType === 'REFUND')).toHaveLength(1);
  });

  it('does not retry a provider-confirmed refund blocked by an accounting failure', async () => {
    const { service, adapter, folioService, operations } = setup();
    await service.capture(propertyId, { paymentId: 'gateway-1', amount: 500, idempotencyKey: 'capture-refund-settlement-failure' } as any, actor);
    const originalPaymentId = operations[0].folioPaymentId;
    const provider = jest.spyOn(adapter, 'refundPayment');
    folioService.postCharge.mockRejectedValue(new Error('ledger persistence unavailable'));
    const dto = { paymentId: 'gateway-1', originalPaymentId, amount: 100, reason: 'Must reconcile', idempotencyKey: 'refund-settlement-failure' } as any;
    await expect(service.refund(propertyId, dto, actor)).rejects.toThrow(ConflictException);
    expect(operations[1].failureCode).toBe('FOLIO_REFUND_SETTLEMENT_FAILED');
    folioService.postCharge.mockRejectedValue(new Error('still unavailable'));
    await expect(service.refund(propertyId, dto, actor)).rejects.toThrow(ConflictException);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('rejects a refund larger than the provider-confirmed captured amount', async () => {
    const { service, adapter, operations } = setup();
    await service.capture(propertyId, { paymentId: 'gateway-1', amount: 500, idempotencyKey: 'capture-refund-bound' } as any, actor);
    const provider = jest.spyOn(adapter, 'refundPayment');
    await expect(service.refund(propertyId, { paymentId: 'gateway-1', originalPaymentId: operations[0].folioPaymentId, amount: 501, reason: 'Too much', idempotencyKey: 'oversized-refund' } as any, actor)).rejects.toThrow(BadRequestException);
    expect(provider).not.toHaveBeenCalled();
  });

  it('uses an immutable adjustment for a refund after Folio close without changing the ledger', async () => {
    const { service, operations, folio, adjustments, transactions } = setup();
    await service.capture(propertyId, { paymentId: 'gateway-1', amount: 500, idempotencyKey: 'capture-before-close' } as any, actor);
    const originalPaymentId = operations[0].folioPaymentId;
    folio.status = 'CLOSED';
    const closedBalance = folio.balance;
    await service.refund(propertyId, { paymentId: 'gateway-1', originalPaymentId, amount: 200, reason: 'Closed folio refund', idempotencyKey: 'refund-after-close' } as any, actor);
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].amount.toString()).toBe('2');
    expect(operations[1].state).toBe('SETTLED');
    expect(operations[1].folioTransactionId).toBeFalsy();
    expect(transactions).toHaveLength(0);
    expect(folio.balance).toBe(closedBalance);
  });
});