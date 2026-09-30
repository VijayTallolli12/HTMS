import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PaymentGatewayOperationState, PaymentGatewayOperationType } from '@prisma/client';
import { createHash } from 'crypto';
import { generateUuidV7 } from '@hms/shared';
import { PaymentMethod, SecurityContext } from '@hms/api-contracts';
import { PrismaService } from '../../../../common/database/prisma.service';
import { FolioService } from '../../finance/services/folio.service';
import { PostChargeDto } from '../../finance/dto/post-charge.dto';
import { RecordPaymentDto } from '../../finance/dto/record-payment.dto';
import {
  AuthorizePaymentGatewayTransactionDto,
  CancelPaymentGatewayTransactionDto,
  CapturePaymentGatewayTransactionDto,
  RefundPaymentGatewayTransactionDto,
} from '../dto/payments.dto';
import { DemoPaymentGatewayAdapter } from './demo-payment-gateway.adapter';
import { PaymentGatewayProviderRegistry } from './payment-gateway-registry';
import { folioAmountToMinorUnits, minorUnitsToFolioAmount } from './payment-currency';

const terminal = new Set<PaymentGatewayOperationState>(['SETTLED', 'FAILED']);
const recoveryStates: PaymentGatewayOperationState[] = ['PROVIDER_CONFIRMED', 'SETTLEMENT_PENDING', 'REQUIRES_RECONCILIATION'];

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function safeProviderResult(value: unknown): Prisma.InputJsonValue {
  const clean = (item: unknown, depth: number): unknown => {
    if (depth > 8) return '[TRUNCATED]';
    if (Array.isArray(item)) return item.slice(0, 100).map((entry) => clean(entry, depth + 1));
    if (!item || typeof item !== 'object') return typeof item === 'string' ? item.slice(0, 2000) : item;
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(item as Record<string, unknown>)) {
      if (/secret|token|password|credential|private.?key|api.?key/i.test(key) || /^authorization$/i.test(key)) continue;
      result[key] = clean(entry, depth + 1);
    }
    return result;
  };
  return (clean(value, 0) ?? {}) as Prisma.InputJsonValue;
}

@Injectable()
export class PaymentGatewayFinancialOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly folioService: FolioService,
    private readonly demoAdapter: DemoPaymentGatewayAdapter,
    private readonly registry: PaymentGatewayProviderRegistry,
  ) {}

  async authorize(propertyId: string, dto: AuthorizePaymentGatewayTransactionDto, actor: SecurityContext): Promise<any> {
    this.assertActorProperty(propertyId, actor);
    const intent = await this.prisma.paymentIntent.findFirst({ where: { propertyId, id: dto.paymentIntentId, deletedAt: null } });
    if (!intent) throw new NotFoundException('Payment intent not found for property.');
    await this.requireDemoConfig(propertyId, intent.paymentProviderConfigId);
    const requestHash = digest({ propertyId, paymentProviderConfigId: intent.paymentProviderConfigId, paymentIntentId: intent.id, amount: intent.amount, currency: intent.currency, paymentMethodId: dto.paymentMethodId ?? null });
    this.assertAmount(intent.amount);
    const key = this.idempotencyKey(dto.idempotencyKey, requestHash);
    const priorOperation = await this.prisma.paymentGatewayOperation.findFirst({ where: { propertyId, operationType: 'AUTHORIZATION', idempotencyKey: key } });
    if (priorOperation) {
      this.verifyReplay(priorOperation, requestHash);
      if (priorOperation.state === 'SETTLED') return this.gatewayTransaction(propertyId, priorOperation.gatewayTransactionId);
      if (priorOperation.providerConfirmedAt) return this.finalizeAuthorization(propertyId, intent, priorOperation);
      if (priorOperation.state !== 'REQUESTED') throw new ConflictException('Authorization provider result is unknown; reconciliation is required before retry.');
    } else {
      if (!['REQUIRES_PAYMENT_METHOD', 'REQUIRES_CONFIRMATION', 'REQUIRES_ACTION'].includes(intent.status)) {
        throw new ConflictException(`Cannot authorize payment intent in '${intent.status}' status.`);
      }
      const priorTransaction = await this.prisma.paymentGatewayTransaction.findFirst({ where: { propertyId, paymentIntentId: intent.id } });
      if (priorTransaction) throw new ConflictException('Payment intent already has a gateway authorization.');
    }
    const operation = await this.reserveOperation({
      propertyId, paymentProviderConfigId: intent.paymentProviderConfigId, paymentIntentId: intent.id,
      operationType: 'AUTHORIZATION', idempotencyKey: key,
      requestHash,
      amount: intent.amount, currency: intent.currency, actor, reserveAmount: false,
    });
    if (operation.state === 'SETTLED') return this.gatewayTransaction(propertyId, operation.gatewayTransactionId);
    if (terminal.has(operation.state)) throw new ConflictException(`Authorization operation is ${operation.state}.`);
    if (operation.providerConfirmedAt) return this.finalizeAuthorization(propertyId, intent, operation);
    if (operation.state !== 'REQUESTED') throw new ConflictException('Authorization requires reconciliation; provider call will not be repeated.');
    await this.markAuthorizationPending(propertyId, intent.id, operation.id);
    try {
      const result = await this.demoAdapter.authorizePayment({ paymentIntentId: intent.externalId, paymentMethodId: dto.paymentMethodId, idempotencyKey: operation.providerIdempotencyKey });
      if (result.status === 'CANCELLED') return this.failOperation(operation.id, 'PROVIDER_AUTHORIZATION_CANCELLED', 'Provider cancelled authorization.');
      if (result.status !== 'SUCCEEDED') {
        await this.markUnknown(operation.id, `Provider returned non-final authorization status '${result.status}'.`);
        throw new ConflictException('Authorization requires provider reconciliation; non-final provider result was not treated as a decline.');
      }
      await this.prisma.paymentGatewayOperation.updateMany({
        where: { id: operation.id, state: 'PROVIDER_PENDING' },
        data: { state: 'PROVIDER_CONFIRMED', providerReference: result.externalId, providerResult: safeProviderResult(result), providerConfirmedAt: new Date() },
      });
      return this.finalizeAuthorization(propertyId, intent, await this.readOperation(propertyId, operation.id));
    } catch (error) {
      const latest = await this.readOperation(propertyId, operation.id);
      if (latest && latest.state !== 'FAILED' && !latest.providerConfirmedAt) await this.markUnknown(operation.id, 'Authorization provider outcome was not safely confirmed.');
      throw error;
    }
  }

  private async finalizeAuthorization(propertyId: string, intent: any, operation: any): Promise<any> {
    if (!operation?.providerConfirmedAt || !operation.providerResult) throw new ConflictException('Authorization provider confirmation is not durably recorded.');
    if (operation.state === 'REQUIRES_RECONCILIATION' || operation.state === 'FAILED') throw new ConflictException('Authorization requires reconciliation; this operation state will not be overwritten.');
    if (operation.state === 'SETTLED' && operation.gatewayTransactionId) return this.gatewayTransaction(propertyId, operation.gatewayTransactionId);
    const result = operation.providerResult as any;
    try {
      let transactionId: string | null = null;
      await this.prisma.$transaction(async (tx) => {
        let transaction = await tx.paymentGatewayTransaction.findFirst({ where: { propertyId, paymentIntentId: intent.id } });
        if (transaction && transaction.status !== 'AUTHORIZED') throw new ConflictException('A gateway transaction already exists for this intent; authorization state was not changed.');
        if (transaction && (transaction.idempotencyKey !== operation.providerIdempotencyKey || transaction.externalId !== result.externalId || transaction.amount !== intent.amount || transaction.currency !== intent.currency || transaction.paymentProviderConfigId !== intent.paymentProviderConfigId)) {
          throw new ConflictException('A gateway transaction was persisted with different authorization details.');
        }
        if (!transaction) {
          transaction = await tx.paymentGatewayTransaction.create({ data: {
            id: generateUuidV7(), propertyId, paymentProviderConfigId: intent.paymentProviderConfigId,
            paymentIntentId: intent.id, externalId: result.externalId, amount: intent.amount,
            authorizedAmount: intent.amount, capturedAmount: 0, pendingCaptureAmount: 0, pendingRefundAmount: 0,
            refundedAmount: 0, currency: intent.currency, status: 'AUTHORIZED', description: intent.description,
            metadata: intent.metadata as Prisma.InputJsonValue, authorizationCode: result.authorizationCode,
            idempotencyKey: operation.providerIdempotencyKey, version: 0,
          } });
        }
        transactionId = transaction.id;
        await tx.paymentGatewayOperation.update({ where: { id: operation.id }, data: {
          gatewayTransactionId: transaction.id, state: 'SETTLED', settledAt: new Date(),
        } });
        const intentChanged = await tx.paymentIntent.updateMany({
          where: { propertyId, id: intent.id, status: 'PROCESSING' },
          data: { status: 'PROCESSING', version: { increment: 1 } },
        });
        if (intentChanged.count !== 1) throw new ConflictException('Payment intent changed during authorization finalization.');
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 });
      return this.gatewayTransaction(propertyId, transactionId);
    } catch (error) {
      await this.prisma.paymentGatewayOperation.updateMany({ where: { id: operation.id, state: { notIn: ['SETTLED', 'FAILED', 'REQUIRES_RECONCILIATION'] } }, data: {
        state: 'SETTLEMENT_PENDING', reconciliationReason: 'Provider authorization confirmed; local gateway transaction finalization will resume without another provider call.',
        failureCode: 'AUTHORIZATION_PERSISTENCE_PENDING', failureMessage: this.safeError(error),
      } });
      throw error;
    }
  }

  async capture(propertyId: string, dto: CapturePaymentGatewayTransactionDto, actor: SecurityContext): Promise<any> {
    this.assertActorProperty(propertyId, actor);
    const payment = await this.prisma.paymentGatewayTransaction.findFirst({ where: { propertyId, id: dto.paymentId, deletedAt: null } });
    if (!payment) throw new NotFoundException('Gateway transaction not found for property.');
    await this.requireDemoConfig(propertyId, payment.paymentProviderConfigId);
    const suppliedKey = dto.idempotencyKey?.trim();
    const replay = suppliedKey ? await this.prisma.paymentGatewayOperation.findFirst({
      where: { propertyId, operationType: 'CAPTURE', idempotencyKey: suppliedKey },
    }) : null;
    if (replay && dto.amount !== undefined && dto.amount !== replay.amount) {
      throw new ConflictException('Idempotency key was reused with a different capture amount.');
    }
    if (replay && (replay.gatewayTransactionId !== payment.id || replay.paymentProviderConfigId !== payment.paymentProviderConfigId)) {
      throw new ConflictException('Idempotency key was reused for a different gateway transaction.');
    }
    if (!replay && payment.status !== 'AUTHORIZED') {
      if (payment.authorizedAmount === 0 || payment.capturedAmount === 0) {
        throw new ConflictException('Legacy captured transaction amounts are not authoritative; reconcile provider history before another capture.');
      }
      if (payment.status !== 'CAPTURED') throw new ConflictException('Only an authorized transaction may be captured.');
    }
    const authorizedAmount = payment.authorizedAmount || (payment.status === 'AUTHORIZED' ? payment.amount : 0);
    const amount = replay?.amount ?? dto.amount ?? authorizedAmount - payment.capturedAmount - payment.pendingCaptureAmount;
    this.assertAmount(amount);
    if (!replay && (amount > authorizedAmount - payment.capturedAmount - payment.pendingCaptureAmount)) {
      throw new BadRequestException('Capture exceeds remaining authorized amount.');
    }
    const requestHash = digest({ propertyId, paymentProviderConfigId: payment.paymentProviderConfigId, paymentId: payment.id, amount, currency: payment.currency });
    if (replay && replay.requestHash !== requestHash) throw new ConflictException('Idempotency key was reused with a different financial request.');
    if (replay?.providerConfirmedAt) {
      await this.settleCapture(propertyId, replay.id);
      const resumed = await this.readOperation(propertyId, replay.id);
      if (resumed?.state !== 'SETTLED') throw new ConflictException('Provider capture succeeded but Folio settlement requires reconciliation.');
      return this.gatewayTransaction(propertyId, payment.id);
    }
    if (replay && replay.state === 'SETTLED') return this.gatewayTransaction(propertyId, payment.id);
    const settlementContext = replay
      ? { folioId: replay.folioId, reservationId: replay.reservationId }
      : await this.folioForTransaction(propertyId, payment);
    const operation = await this.reserveOperation({
      propertyId, paymentProviderConfigId: payment.paymentProviderConfigId, paymentIntentId: payment.paymentIntentId,
      gatewayTransactionId: payment.id, folioId: settlementContext?.folioId, reservationId: settlementContext?.reservationId,
      operationType: 'CAPTURE', idempotencyKey: this.idempotencyKey(dto.idempotencyKey, requestHash),
      requestHash,
      amount, currency: payment.currency, actor, reserveAmount: true,
    });
    if (operation.state === 'SETTLED') return this.gatewayTransaction(propertyId, payment.id);
    if (operation.state === 'REQUIRES_RECONCILIATION') {
      if (operation.failureCode === 'FOLIO_CLOSED_AFTER_CAPTURE' && operation.providerConfirmedAt) {
        await this.settleCapture(propertyId, operation.id);
        return this.gatewayTransaction(propertyId, payment.id);
      }
      throw new ConflictException('Capture requires authorized reconciliation; no additional provider call will be made.');
    }
    if (terminal.has(operation.state)) throw new ConflictException(`Capture operation is ${operation.state}.`);
    if (operation.providerConfirmedAt) {
      await this.settleCapture(propertyId, operation.id);
      const settled = await this.readOperation(propertyId, operation.id);
      if (settled?.state !== 'SETTLED') throw new ConflictException('Provider capture succeeded but Folio settlement requires reconciliation.');
      return this.gatewayTransaction(propertyId, payment.id);
    }
    if (operation.state !== 'REQUESTED') throw new ConflictException('Capture provider result is unknown; reconciliation is required before any retry.');
    await this.markProviderPending(operation.id);
    try {
      const result = await this.demoAdapter.capturePayment({ paymentId: payment.externalId, amount: operation.amount, idempotencyKey: operation.providerIdempotencyKey });
      if (result.status !== 'CAPTURED') {
        if (result.status === 'FAILED') return this.failOperation(operation.id, 'PROVIDER_CAPTURE_FAILED', 'Provider declined capture.');
        await this.markUnknown(operation.id, 'Capture result is not authoritative.');
        throw new ConflictException('Capture requires provider reconciliation.');
      }
      await this.confirmCapture(operation, result);
      await this.settleCapture(propertyId, operation.id);
      const settled = await this.readOperation(propertyId, operation.id);
      if (settled?.state !== 'SETTLED') throw new ConflictException('Provider capture succeeded but Folio settlement requires reconciliation.');
      return this.gatewayTransaction(propertyId, payment.id);
    } catch (error) {
      const latest = await this.readOperation(propertyId, operation.id);
      if (latest && !['SETTLED', 'FAILED', 'REQUIRES_RECONCILIATION'].includes(latest.state)) await this.markUnknown(operation.id, 'Capture provider outcome or local settlement is uncertain.');
      if (latest?.providerConfirmedAt) {
        if (latest.state === 'SETTLED') return this.gatewayTransaction(propertyId, payment.id);
        throw error;
      }
      throw error;
    }
  }

  async refund(propertyId: string, dto: RefundPaymentGatewayTransactionDto, actor: SecurityContext): Promise<any> {
    this.assertActorProperty(propertyId, actor);
    const payment = await this.prisma.paymentGatewayTransaction.findFirst({ where: { propertyId, id: dto.paymentId, deletedAt: null } });
    if (!payment) throw new NotFoundException('Gateway transaction not found for property.');
    await this.requireDemoConfig(propertyId, payment.paymentProviderConfigId);
    const suppliedKey = dto.idempotencyKey?.trim();
    const replay = suppliedKey ? await this.prisma.paymentGatewayOperation.findFirst({
      where: { propertyId, operationType: 'REFUND', idempotencyKey: suppliedKey },
    }) : null;
    if (replay && (replay.gatewayTransactionId !== payment.id || replay.paymentProviderConfigId !== payment.paymentProviderConfigId)) {
      throw new ConflictException('Idempotency key was reused for a different gateway transaction.');
    }
    if (replay && dto.amount !== undefined && dto.amount !== replay.amount) {
      throw new ConflictException('Idempotency key was reused with a different refund amount.');
    }
    if (replay && dto.reason?.trim() && dto.reason.trim() !== replay.reason) {
      throw new ConflictException('Idempotency key was reused with a different refund reason.');
    }
    const eligible = await this.capturedFolioPayments(propertyId, payment);
    let original = replay?.originalPaymentId ? eligible.find((row) => row.id === replay.originalPaymentId) : undefined;
    if (!original && dto.originalPaymentId) original = eligible.find((row) => row.id === dto.originalPaymentId);
    if (dto.originalPaymentId && !original && !replay) throw new BadRequestException('originalPaymentId is not an eligible captured Folio payment for this transaction.');
    if (!replay && !dto.originalPaymentId && eligible.length > 1) throw new BadRequestException('originalPaymentId is required when multiple captured payments are eligible.');
    if (!original && eligible.length === 1) original = eligible[0];
    if (!original && replay?.originalPaymentId) {
      original = await this.prisma.payment.findFirst({ where: { propertyId, id: replay.originalPaymentId } });
    }
    if (replay && dto.originalPaymentId && dto.originalPaymentId !== replay.originalPaymentId) {
      throw new ConflictException('Idempotency key was reused for a different original Folio payment.');
    }
    if (!original) throw new ConflictException('Refund settlement requires a linked captured Folio payment.');
    if (original.propertyId !== propertyId || (!eligible.some((row) => row.id === original.id) && !replay)) {
      throw new BadRequestException('Original payment is not an eligible payment for this property and gateway transaction.');
    }
    const folio = await this.prisma.folio.findFirst({ where: { propertyId, id: original.folioId } });
    if (!folio) throw new NotFoundException('Original payment Folio not found for property.');
    if (original.folioId !== folio.id || original.propertyId !== propertyId || original.currency.toUpperCase() !== payment.currency.toUpperCase() || folio.currency.toUpperCase() !== payment.currency.toUpperCase()) {
      throw new ConflictException('Refund currencies or original Folio relationship do not match the captured payment.');
    }
    const originalAmountMinor = folioAmountToMinorUnits(String(original.amount), original.currency);
    const capturedForOriginal = await this.capturedAmountForPayment(propertyId, payment.id, original.id);
    const refundedForOriginal = await this.refundedAmountForPayment(propertyId, payment.id, original.id);
    if (!replay && (capturedForOriginal <= 0 || originalAmountMinor < capturedForOriginal)) throw new ConflictException('Captured Folio payments do not match gateway capture history; manual reconciliation is required.');
    if (!replay && refundedForOriginal > capturedForOriginal) throw new ConflictException('Previously confirmed refunds exceed captured Folio payments; manual reconciliation is required.');
    if (!replay && payment.capturedAmount === 0 && ['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status)) {
      throw new ConflictException('Legacy captured amounts are not authoritative; reconcile provider history before refunding.');
    }
    const amount = replay?.amount ?? dto.amount ?? payment.capturedAmount - payment.refundedAmount - payment.pendingRefundAmount;
    this.assertAmount(amount);
    if (!dto.reason?.trim() && !replay?.reason) throw new BadRequestException('A refund reason is required.');
    if (!replay && amount > Math.min(payment.capturedAmount - payment.refundedAmount - payment.pendingRefundAmount, capturedForOriginal - refundedForOriginal)) {
      throw new BadRequestException('Refund exceeds remaining captured amount for the gateway transaction or original Folio payment.');
    }
    const requestedReason = replay?.reason || dto.reason.trim();
    const requestHash = digest({ propertyId, paymentProviderConfigId: payment.paymentProviderConfigId, paymentId: payment.id, originalPaymentId: original.id, amount, currency: payment.currency, reason: requestedReason });
    if (replay && replay.requestHash !== requestHash) throw new ConflictException('Idempotency key was reused with a different financial request.');
    if (replay?.state === 'SETTLED') return this.gatewayTransaction(propertyId, payment.id);
    if (replay?.providerConfirmedAt) {
      await this.settleRefund(propertyId, replay.id, replay.reason || dto.reason.trim());
      const resumed = await this.readOperation(propertyId, replay.id);
      if (resumed?.state !== 'SETTLED') throw new ConflictException('Provider refund succeeded but Folio/adjustment settlement requires reconciliation.');
      return this.gatewayTransaction(propertyId, payment.id);
    }
    const operation = await this.reserveOperation({
      propertyId, paymentProviderConfigId: payment.paymentProviderConfigId, paymentIntentId: payment.paymentIntentId,
      gatewayTransactionId: payment.id, folioId: folio.id, reservationId: folio.reservationId, originalPaymentId: original.id,
      operationType: 'REFUND', idempotencyKey: this.idempotencyKey(dto.idempotencyKey, requestHash),
      requestHash,
      amount, currency: payment.currency, actor, reserveAmount: true, reason: requestedReason,
    });
    if (operation.state === 'SETTLED') return this.gatewayTransaction(propertyId, payment.id);
    if (operation.state === 'REQUIRES_RECONCILIATION') {
      if (operation.providerConfirmedAt && !['PROVIDER_OUTCOME_UNKNOWN', 'FOLIO_REFUND_SETTLEMENT_FAILED'].includes(operation.failureCode)) {
        await this.settleRefund(propertyId, operation.id, operation.reason || requestedReason);
        const resumed = await this.readOperation(propertyId, operation.id);
        if (resumed?.state === 'SETTLED') return this.gatewayTransaction(propertyId, payment.id);
      }
      throw new ConflictException('Refund requires authorized reconciliation; no additional provider call will be made.');
    }
    if (terminal.has(operation.state)) throw new ConflictException(`Refund operation is ${operation.state}.`);
    if (operation.providerConfirmedAt) {
      await this.settleRefund(propertyId, operation.id, operation.reason || dto.reason.trim());
      const settled = await this.readOperation(propertyId, operation.id);
      if (settled?.state !== 'SETTLED') throw new ConflictException('Provider refund succeeded but Folio/adjustment settlement requires reconciliation.');
      return this.gatewayTransaction(propertyId, payment.id);
    }
    if (operation.state !== 'REQUESTED') throw new ConflictException('Refund provider result is unknown; reconciliation is required before any retry.');
    await this.markProviderPending(operation.id);
    try {
      const result = await this.demoAdapter.refundPayment({ paymentId: payment.externalId, amount: operation.amount, reason: operation.reason || requestedReason, idempotencyKey: operation.providerIdempotencyKey });
      if (result.status !== 'REFUNDED' && result.status !== 'PARTIALLY_REFUNDED') {
        if (result.status === 'FAILED') return this.failOperation(operation.id, 'PROVIDER_REFUND_FAILED', 'Provider declined refund.');
        await this.markUnknown(operation.id, 'Refund result is not authoritative.');
        throw new ConflictException('Refund requires provider reconciliation.');
      }
      await this.confirmRefund(operation, result, operation.reason || requestedReason);
      await this.settleRefund(propertyId, operation.id, operation.reason || dto.reason.trim());
      const settled = await this.readOperation(propertyId, operation.id);
      if (settled?.state !== 'SETTLED') throw new ConflictException('Provider refund succeeded but Folio/adjustment settlement requires reconciliation.');
      return this.gatewayTransaction(propertyId, payment.id);
    } catch (error) {
      const latest = await this.readOperation(propertyId, operation.id);
      if (latest && !['SETTLED', 'FAILED', 'REQUIRES_RECONCILIATION'].includes(latest.state)) await this.markUnknown(operation.id, 'Refund provider outcome or local settlement is uncertain.');
      if (latest?.providerConfirmedAt) {
        if (latest.state === 'SETTLED') return this.gatewayTransaction(propertyId, payment.id);
        throw new ConflictException('Provider refund succeeded but Folio/adjustment settlement requires reconciliation.');
      }
      throw error;
    }
  }

  async cancel(propertyId: string, dto: CancelPaymentGatewayTransactionDto, actor: SecurityContext): Promise<any> {
    this.assertActorProperty(propertyId, actor);
    const intent = await this.prisma.paymentIntent.findFirst({ where: { propertyId, id: dto.paymentIntentId, deletedAt: null } });
    if (!intent) throw new NotFoundException('Payment intent not found for property.');
    await this.requireDemoConfig(propertyId, intent.paymentProviderConfigId);
    const requestHash = digest({ propertyId, paymentProviderConfigId: intent.paymentProviderConfigId, paymentIntentId: intent.id, amount: intent.amount, currency: intent.currency });
    this.assertAmount(intent.amount);
    const key = this.idempotencyKey(dto.idempotencyKey, requestHash);
    const existing = await this.prisma.paymentGatewayOperation.findFirst({ where: { propertyId, operationType: 'CANCEL', idempotencyKey: key } });
    if (!existing && !['REQUIRES_PAYMENT_METHOD', 'REQUIRES_CONFIRMATION', 'REQUIRES_ACTION'].includes(intent.status)) {
      throw new BadRequestException(`Cannot cancel intent in '${intent.status}' status; only an un-authorized intent may be cancelled.`);
    }
    if (existing && (existing.paymentIntentId !== intent.id || existing.paymentProviderConfigId !== intent.paymentProviderConfigId)) throw new ConflictException('Idempotency key was reused for a different payment intent.');
    const operation = await this.reserveOperation({
      propertyId, paymentProviderConfigId: intent.paymentProviderConfigId, paymentIntentId: intent.id,
      operationType: 'CANCEL', idempotencyKey: key,
      requestHash,
      amount: intent.amount, currency: intent.currency, actor, reserveAmount: false,
    });
    if (operation.requestHash !== requestHash) throw new ConflictException('Idempotency key was reused with a different cancellation request.');
    if (operation.state === 'SETTLED') return this.prisma.paymentIntent.findFirst({ where: { propertyId, id: intent.id } });
    if (terminal.has(operation.state)) throw new ConflictException(`Cancel operation is ${operation.state}.`);
    if (operation.state === 'REQUIRES_RECONCILIATION') {
      if (operation.providerConfirmedAt) {
        await this.settleCancel(propertyId, operation);
        const resumed = await this.prisma.paymentIntent.findFirst({ where: { propertyId, id: intent.id } });
        if (resumed?.status === 'CANCELLED') return resumed;
      }
      throw new ConflictException('Cancellation requires authorized reconciliation; no additional provider call will be made.');
    }
    if (operation.providerConfirmedAt) {
      await this.settleCancel(propertyId, operation);
      return this.prisma.paymentIntent.findFirst({ where: { propertyId, id: intent.id } });
    }
    if (operation.state !== 'REQUESTED') throw new ConflictException('Cancel provider result is unknown; reconciliation is required before retry.');
    await this.markProviderPending(operation.id);
    try {
      const result = await this.demoAdapter.cancelPayment({ paymentIntentId: intent.externalId, idempotencyKey: operation.providerIdempotencyKey });
      if (result.status !== 'CANCELLED') {
        await this.markUnknown(operation.id, 'Cancel result is not authoritative.');
        throw new ConflictException('Cancel requires provider reconciliation.');
      }
      const confirmed = await this.prisma.paymentGatewayOperation.updateMany({
        where: { id: operation.id, state: 'PROVIDER_PENDING', providerConfirmedAt: null },
        data: { state: 'PROVIDER_CONFIRMED', providerReference: result.externalId, providerResult: safeProviderResult(result), providerConfirmedAt: new Date() },
      });
      if (confirmed.count !== 1) throw new ConflictException('Cancellation operation state changed before provider confirmation could be persisted.');
      const persisted = await this.readOperation(propertyId, operation.id);
      if (!persisted?.providerConfirmedAt || persisted.providerReference !== result.externalId) {
        throw new ConflictException('Provider cancellation confirmation could not be durably recorded.');
      }
      await this.settleCancel(propertyId, persisted);
      return this.prisma.paymentIntent.findFirst({ where: { propertyId, id: intent.id } });
    } catch (error) {
      const latest = await this.readOperation(propertyId, operation.id);
      if (!latest?.providerConfirmedAt) await this.markUnknown(operation.id, 'Cancel provider outcome was not safely confirmed.');
      if (latest?.providerConfirmedAt && latest.state === 'SETTLED') return this.prisma.paymentIntent.findFirst({ where: { propertyId, id: intent.id } });
      throw error;
    }
  }

  private async settleCancel(propertyId: string, operation: any): Promise<void> {
    if (!operation?.paymentIntentId || !operation.providerConfirmedAt) throw new ConflictException('Cancel operation is not provider-confirmed.');
    if (operation.state === 'SETTLED') return;
    if (operation.state === 'FAILED' || operation.state === 'REQUIRES_RECONCILIATION') throw new ConflictException('Cancellation operation requires authorized manual reconciliation.');
    try {
      await this.prisma.$transaction(async (tx) => {
        const intentChanged = await tx.paymentIntent.updateMany({
          where: { propertyId, id: operation.paymentIntentId, status: { in: ['REQUIRES_PAYMENT_METHOD', 'REQUIRES_CONFIRMATION', 'REQUIRES_ACTION'] } },
          data: { status: 'CANCELLED', version: { increment: 1 } },
        });
        if (intentChanged.count !== 1) {
          const currentIntent = await tx.paymentIntent.findFirst({ where: { propertyId, id: operation.paymentIntentId } });
          if (currentIntent?.status !== 'CANCELLED') throw new ConflictException('Payment intent changed before cancellation settlement; manual reconciliation is required.');
        }
        const currentOperation = await tx.paymentGatewayOperation.findFirst({ where: { propertyId, id: operation.id } });
        if (!currentOperation?.providerConfirmedAt || ['FAILED', 'REQUIRES_RECONCILIATION'].includes(currentOperation.state)) {
          throw new ConflictException('Cancellation operation state no longer permits automatic settlement.');
        }
        const intent = await tx.paymentIntent.findFirst({ where: { propertyId, id: operation.paymentIntentId } });
        if (intent?.status !== 'CANCELLED') throw new ConflictException('Payment intent cancellation did not persist; manual reconciliation is required.');
        const changed = await tx.paymentGatewayOperation.updateMany({
          where: { propertyId, id: operation.id, providerConfirmedAt: { not: null }, state: { in: ['PROVIDER_CONFIRMED', 'SETTLEMENT_PENDING'] } },
          data: { state: 'SETTLED', settledAt: new Date() },
        });
        if (changed.count !== 1) throw new ConflictException('Cancellation operation state changed during settlement.');
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 });
    } catch (error) {
      await this.prisma.paymentGatewayOperation.updateMany({ where: { id: operation.id, state: { notIn: ['SETTLED', 'FAILED', 'REQUIRES_RECONCILIATION'] } }, data: {
        state: 'SETTLEMENT_PENDING', reconciliationReason: 'Provider cancellation confirmed; local intent update will resume without another provider call.',
        failureCode: 'CANCEL_PERSISTENCE_PENDING', failureMessage: this.safeError(error),
      } });
      throw error;
    }
  }

  async listRecoveryOperations(propertyId: string): Promise<any[]> {
    return this.prisma.paymentGatewayOperation.findMany({ where: { propertyId, state: { in: recoveryStates } }, orderBy: { createdAt: 'asc' } });
  }

  async reconcileOperation(propertyId: string, operationId: string): Promise<any> {
    const operation = await this.readOperation(propertyId, operationId);
    if (!operation) throw new NotFoundException('Payment operation not found for property.');
    if (operation.state === 'SETTLED' || operation.state === 'FAILED') return operation;
    if (operation.state === 'REQUIRES_RECONCILIATION') {
      if (operation.failureCode === 'FOLIO_CLOSED_AFTER_CAPTURE' && operation.operationType === 'CAPTURE') {
        await this.settleCapture(propertyId, operation.id);
        return this.readOperation(propertyId, operation.id);
      }
      return operation;
    }
    if (operation.providerConfirmedAt) {
      if (operation.operationType === 'AUTHORIZATION') {
        const intent = await this.prisma.paymentIntent.findFirst({ where: { propertyId, id: operation.paymentIntentId } });
        if (!intent) throw new NotFoundException('Payment intent not found for property.');
        await this.finalizeAuthorization(propertyId, intent, operation);
      }
      if (operation.operationType === 'CAPTURE') await this.settleCapture(propertyId, operation.id);
      if (operation.operationType === 'REFUND')    await this.settleRefund(propertyId, operation.id, operation.reason || 'Gateway refund');
      if (operation.operationType === 'CANCEL') await this.settleCancel(propertyId, operation);
      return this.readOperation(propertyId, operation.id);
    }
    const config = await this.requireDemoConfig(propertyId, operation.paymentProviderConfigId);
    const catalog = this.registry.get(config.provider);
    const provider = catalog?.adapterStatus === 'DEMO_ADAPTER' ? this.demoAdapter : null;
    if (!provider) return operation;
    // The bundled DEMO adapter has no authoritative status contract: never replay an unknown call.
    await this.markUnknown(operation.id, 'Provider has no authoritative status lookup; manual reconciliation required.');
    return this.readOperation(propertyId, operation.id);
  }

  async settleProviderConfirmed(propertyId: string, operationId: string): Promise<any> {
    const operation = await this.readOperation(propertyId, operationId);
    if (!operation) throw new NotFoundException('Payment operation not found for property.');
    if (operation.state === 'REQUIRES_RECONCILIATION') {
      if (operation.failureCode === 'FOLIO_CLOSED_AFTER_CAPTURE' && operation.operationType === 'CAPTURE') {
        await this.settleCapture(propertyId, operationId);
        return this.readOperation(propertyId, operationId);
      }
      throw new ConflictException('Operation requires authorized manual reconciliation; no financial state was changed.');
    }
    if (!operation.providerConfirmedAt) throw new ConflictException('Provider confirmation is not durably recorded.');
    if (operation.operationType === 'AUTHORIZATION') {
      const intent = await this.prisma.paymentIntent.findFirst({ where: { propertyId, id: operation.paymentIntentId } });
      if (!intent) throw new NotFoundException('Payment intent not found for property.');
      await this.finalizeAuthorization(propertyId, intent, operation);
    }
    if (operation.operationType === 'CAPTURE') await this.settleCapture(propertyId, operationId);
    if (operation.operationType === 'REFUND') await this.settleRefund(propertyId, operationId, operation.reason || 'Gateway refund');
    if (operation.operationType === 'CANCEL') await this.settleCancel(propertyId, operation);
    return this.readOperation(propertyId, operationId);
  }

  private async reserveOperation(input: {
    propertyId: string; paymentProviderConfigId: string; paymentIntentId?: string | null;
    gatewayTransactionId?: string | null; folioId?: string | null; reservationId?: string | null;
    originalPaymentId?: string | null; operationType: PaymentGatewayOperationType; idempotencyKey: string;
    requestHash: string; amount: number; currency: string; actor: SecurityContext; reserveAmount: boolean; reason?: string;
  }): Promise<any> {
    const existing = await this.prisma.paymentGatewayOperation.findFirst({ where: { propertyId: input.propertyId, operationType: input.operationType, idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.gatewayTransactionId !== (input.gatewayTransactionId || null) || existing.paymentIntentId !== (input.paymentIntentId || null) || existing.paymentProviderConfigId !== input.paymentProviderConfigId) {
        throw new ConflictException('Idempotency key was reused for a different payment entity.');
      }
      return this.verifyReplay(existing, input.requestHash);
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const duplicate = await tx.paymentGatewayOperation.findFirst({ where: { propertyId: input.propertyId, operationType: input.operationType, idempotencyKey: input.idempotencyKey } });
        if (duplicate) {
          if (duplicate.gatewayTransactionId !== (input.gatewayTransactionId || null) || duplicate.paymentIntentId !== (input.paymentIntentId || null) || duplicate.paymentProviderConfigId !== input.paymentProviderConfigId) {
            throw new ConflictException('Idempotency key was reused for a different payment entity.');
          }
          return this.verifyReplay(duplicate, input.requestHash);
        }
        if (input.operationType === 'AUTHORIZATION') {
          const cancellation = await tx.paymentGatewayOperation.findFirst({ where: {
            propertyId: input.propertyId, paymentIntentId: input.paymentIntentId,
            operationType: 'CANCEL', state: { not: 'FAILED' },
          } });
          if (cancellation) throw new ConflictException('Payment intent has a cancellation operation; authorization is blocked.');
        }
        if (input.operationType === 'CANCEL') {
          const authorization = await tx.paymentGatewayOperation.findFirst({ where: {
            propertyId: input.propertyId, paymentIntentId: input.paymentIntentId,
            operationType: 'AUTHORIZATION', state: { not: 'FAILED' },
          } });
          if (authorization) throw new ConflictException('Payment intent has an authorization operation; cancellation is blocked.');
          const transaction = await tx.paymentGatewayTransaction.findFirst({ where: {
            propertyId: input.propertyId, paymentIntentId: input.paymentIntentId,
          } });
          if (transaction) throw new ConflictException('An authorized gateway transaction exists; intent cancellation cannot void its funds.');
        }
        const id = generateUuidV7();
        if (input.reserveAmount && input.gatewayTransactionId) {
          if (input.operationType === 'CAPTURE') {
            const count = await tx.$executeRaw(Prisma.sql`UPDATE "platform_schema"."payment_gateway_transactions" SET "authorized_amount" = CASE WHEN "authorized_amount" = 0 AND "status" = 'AUTHORIZED' THEN "amount" ELSE "authorized_amount" END, "pending_capture_amount" = "pending_capture_amount" + ${input.amount}, "version" = "version" + 1 WHERE "property_id" = ${input.propertyId} AND "id" = ${input.gatewayTransactionId} AND CASE WHEN "authorized_amount" = 0 AND "status" = 'AUTHORIZED' THEN "amount" ELSE "authorized_amount" END - "captured_amount" - "pending_capture_amount" >= ${input.amount} AND "status" IN ('AUTHORIZED', 'CAPTURED')`);
            if (count !== 1) throw new BadRequestException('Capture exceeds remaining authorized amount.');
          }
          if (input.operationType === 'REFUND') {
            if (!input.originalPaymentId) throw new BadRequestException('Refund reservation requires an original Folio payment.');
            const captures = await tx.paymentGatewayOperation.findMany({
              where: { propertyId: input.propertyId, gatewayTransactionId: input.gatewayTransactionId, operationType: 'CAPTURE', folioPaymentId: input.originalPaymentId, providerConfirmedAt: { not: null } },
              select: { amount: true },
            });
            const refunds = await tx.paymentGatewayOperation.findMany({
              where: { propertyId: input.propertyId, gatewayTransactionId: input.gatewayTransactionId, operationType: 'REFUND', originalPaymentId: input.originalPaymentId, state: { not: 'FAILED' } },
              select: { amount: true },
            });
            const capturedForOriginal = captures.reduce((sum, item) => sum + item.amount, 0);
            const alreadyRefundedForOriginal = refunds.reduce((sum, item) => sum + item.amount, 0);
            if (capturedForOriginal - alreadyRefundedForOriginal < input.amount) throw new BadRequestException('Refund exceeds the remaining captured amount for the original Folio payment.');
            const reserved = await tx.$executeRaw(Prisma.sql`UPDATE "platform_schema"."payment_gateway_transactions" SET "pending_refund_amount" = "pending_refund_amount" + ${input.amount}, "version" = "version" + 1 WHERE "property_id" = ${input.propertyId} AND "id" = ${input.gatewayTransactionId} AND "captured_amount" - "refunded_amount" - "pending_refund_amount" >= ${input.amount}`);
            if (reserved !== 1) throw new BadRequestException('Refund exceeds remaining captured gateway amount.');
          }
        }
        return tx.paymentGatewayOperation.create({ data: {
          id, propertyId: input.propertyId, paymentProviderConfigId: input.paymentProviderConfigId,
          paymentIntentId: input.paymentIntentId || null, gatewayTransactionId: input.gatewayTransactionId || null,
          folioId: input.folioId || null, reservationId: input.reservationId || null, originalPaymentId: input.originalPaymentId || null,
          operationType: input.operationType, idempotencyKey: input.idempotencyKey, requestHash: input.requestHash,
          amount: input.amount, currency: input.currency.toUpperCase(), providerIdempotencyKey: `pgop:${id}`,
          actorId: input.actor.userId, actorHotelGroupId: input.actor.activeContext.hotelGroupId,
          actorSnapshot: this.actorSnapshot(input.actor), state: 'REQUESTED',
          ...(input.reason ? { reason: input.reason } : {}),
        } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 });
    } catch (error: any) {
      if (error?.code === 'P2002' || error?.code === 'P2034') {
        const duplicate = await this.prisma.paymentGatewayOperation.findFirst({ where: { propertyId: input.propertyId, operationType: input.operationType, idempotencyKey: input.idempotencyKey } });
        if (duplicate) {
          if (duplicate.gatewayTransactionId !== (input.gatewayTransactionId || null) || duplicate.paymentIntentId !== (input.paymentIntentId || null) || duplicate.paymentProviderConfigId !== input.paymentProviderConfigId) {
            throw new ConflictException('Idempotency key was reused for a different payment entity.');
          }
          return this.verifyReplay(duplicate, input.requestHash);
        }
        if (error.code === 'P2034') throw new ConflictException('Concurrent financial reservation conflict; retry with the same idempotency key.');
      }
      throw error;
    }
  }

  private paymentPayloadHash(folioId: string, dto: RecordPaymentDto): string {
    const canonical = { folioId, amount: new Prisma.Decimal(dto.amount.trim()).toFixed(4), paymentMethod: dto.paymentMethod, referenceNumber: dto.referenceNumber?.trim() || null };
    return digest(canonical);
  }

  private chargePayloadHash(folioId: string, dto: PostChargeDto): string {
    const canonical = {
      folioId, transactionCode: dto.transactionCode.trim(), description: dto.description.trim(),
      amount: new Prisma.Decimal(dto.amount.trim()).toFixed(4),
      taxAmount: dto.taxAmount ? new Prisma.Decimal(dto.taxAmount.trim()).toFixed(4) : '0.0000',
      reasonCode: dto.reasonCode?.trim() || null,
    };
    return digest(canonical);
  }

  private verifyReplay(operation: any, requestHash: string): any {
    if (operation.requestHash !== requestHash) throw new ConflictException('Idempotency key was reused with a different financial request.');
    return operation;
  }

  private async confirmCapture(operation: any, result: any): Promise<void> {
    // Persist the external provider success independently first. If local accounting
    // fails, recovery can resume without guessing or repeating the provider call.
    const updated = await this.prisma.paymentGatewayOperation.updateMany({
      where: { id: operation.id, state: 'PROVIDER_PENDING', providerConfirmedAt: null },
      data: { state: 'PROVIDER_CONFIRMED', providerReference: result.externalId, providerResult: safeProviderResult(result), providerConfirmedAt: new Date() },
    });
    if (updated.count !== 1) throw new ConflictException('Capture operation state changed before provider confirmation could be persisted.');
    const confirmed = await this.readOperation(operation.propertyId, operation.id);
    if (!confirmed?.providerConfirmedAt || confirmed.providerReference !== result.externalId) {
      throw new ConflictException('Provider capture confirmation could not be durably recorded.');
    }
    await this.applyConfirmedCaptureToGatewayTransaction(confirmed);
  }

  private async applyConfirmedCaptureToGatewayTransaction(operation: any): Promise<void> {
    if (operation.transactionAppliedAt) return;
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.paymentGatewayOperation.findFirst({ where: { propertyId: operation.propertyId, id: operation.id } });
      if (!current?.providerConfirmedAt) throw new ConflictException('Provider capture confirmation is not durable.');
      if (current.transactionAppliedAt) return;
      const changed = await tx.paymentGatewayTransaction.updateMany({ where: { propertyId: operation.propertyId, id: operation.gatewayTransactionId, pendingCaptureAmount: { gte: operation.amount } }, data: {
        pendingCaptureAmount: { decrement: operation.amount }, capturedAmount: { increment: operation.amount }, status: 'CAPTURED',
        capturedAt: (current.providerResult as any)?.capturedAt ? new Date((current.providerResult as any).capturedAt) : new Date(), version: { increment: 1 },
      } });
      if (changed.count !== 1) throw new ConflictException('Capture reservation could not be finalized.');
      const transaction = await tx.paymentGatewayTransaction.findFirst({ where: { propertyId: operation.propertyId, id: operation.gatewayTransactionId } });
      if (transaction && transaction.capturedAmount >= transaction.authorizedAmount && operation.paymentIntentId) {
        await tx.paymentIntent.updateMany({ where: { propertyId: operation.propertyId, id: operation.paymentIntentId }, data: { status: 'SUCCEEDED', version: { increment: 1 } } });
      }
      await tx.paymentGatewayOperation.update({ where: { id: operation.id }, data: { transactionAppliedAt: new Date() } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 });
  }

  private async settleCapture(propertyId: string, operationId: string): Promise<void> {
    let operation = await this.readOperation(propertyId, operationId);
    if (!operation || operation.operationType !== 'CAPTURE' || !operation.providerConfirmedAt) throw new ConflictException('Capture is not provider-confirmed.');
    if (operation.state === 'FAILED') throw new ConflictException('Failed capture operations are immutable and cannot be settled.');
    // Provider confirmation and gateway transaction accounting are durable independently
    // of Folio settlement. Even a late capture must release its reservation and be reflected
    // in capturedAmount, without reopening or modifying a closed Folio.
    await this.applyConfirmedCaptureToGatewayTransaction(operation);
    operation = await this.readOperation(propertyId, operationId);
    if (operation.state === 'REQUIRES_RECONCILIATION') {
      if (operation.failureCode === 'FOLIO_CLOSED_AFTER_CAPTURE') return;
      throw new ConflictException('Capture requires authorized manual reconciliation; automatic Folio settlement is disabled.');
    }
    const folioSnapshot = operation.folioId ? await this.prisma.folio.findFirst({ where: { propertyId, id: operation.folioId } }) : null;
    if (folioSnapshot?.status === 'CLOSED') {
      await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: {
        state: 'REQUIRES_RECONCILIATION', reconciliationReason: 'Provider capture confirmed after Folio close; Folio was not reopened or refunded.',
        failureCode: 'FOLIO_CLOSED_AFTER_CAPTURE', failureMessage: 'Authorized reconciliation decision required.',
      } });
      return;
    }
    if (operation.state === 'PROVIDER_CONFIRMED') {
      await this.prisma.paymentGatewayOperation.updateMany({ where: { id: operation.id, state: 'PROVIDER_CONFIRMED' }, data: { state: 'SETTLEMENT_PENDING' } });
      operation = await this.readOperation(propertyId, operationId);
    }
    if (operation.state === 'SETTLED') return;
    if (operation.folioPaymentId) {
      const persisted = await this.prisma.payment.findFirst({ where: { propertyId, id: operation.folioPaymentId, folioId: operation.folioId } });
      const expected: RecordPaymentDto = {
        amount: minorUnitsToFolioAmount(operation.amount, operation.currency), paymentMethod: PaymentMethod.CREDIT_CARD,
        referenceNumber: operation.providerReference || operation.gatewayTransactionId,
      };
      if (persisted?.payloadHash === this.paymentPayloadHash(operation.folioId, expected)) {
        await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'SETTLED', settledAt: operation.settledAt || new Date(), reconciliationReason: null } });
        return;
      }
      await this.requireReconciliation(operation, 'Saved Folio payment link does not match the confirmed capture payload.');
      return;
    }
    if (!operation.folioId) {
      await this.requireReconciliation(operation, 'Provider capture confirmed without a linked Folio; settlement cannot be asserted.');
      return;
    }
    const key = this.folioPaymentKey(operation.id);
    const expectedPayment: RecordPaymentDto = {
      amount: minorUnitsToFolioAmount(operation.amount, operation.currency), paymentMethod: PaymentMethod.CREDIT_CARD,
      referenceNumber: operation.providerReference || operation.gatewayTransactionId,
    };
    const previouslyPosted = await this.prisma.payment.findUnique({ where: { uq_payment_property_idempotency: { propertyId, idempotencyKey: key } } });
    if (previouslyPosted) {
      if (previouslyPosted.folioId === operation.folioId && previouslyPosted.payloadHash === this.paymentPayloadHash(operation.folioId, expectedPayment)) {
        await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'SETTLED', folioPaymentId: previouslyPosted.id, settledAt: new Date(), reconciliationReason: null, failureCode: null, failureMessage: null } });
        return;
      }
      await this.requireReconciliation(operation, 'Existing Folio payment with the operation idempotency key does not match the provider-confirmed capture.');
      return;
    }
    const folio = await this.prisma.folio.findFirst({ where: { propertyId, id: operation.folioId } });
    const reservation = operation.reservationId
      ? await this.prisma.reservation.findFirst({ where: { propertyId, id: operation.reservationId } })
      : null;
    if (!folio) {
      await this.requireReconciliation(operation, 'Provider capture confirmed but the linked Folio is unavailable.');
      return;
    }
    if (folio.status === 'CLOSED') {
      await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: {
        state: 'REQUIRES_RECONCILIATION', reconciliationReason: 'Provider capture confirmed after Folio close; Folio was not reopened or refunded.',
        failureCode: 'FOLIO_CLOSED_AFTER_CAPTURE', failureMessage: 'Authorized reconciliation decision required.',
      } });
      return;
    }
    if (folio.currency.toUpperCase() !== operation.currency.toUpperCase()) {
      await this.requireReconciliation(operation, 'Gateway and Folio currencies differ; no currency conversion is authorized.');
      return;
    }
    const folioBalanceUnits = folioAmountToMinorUnits(String(folio.balance), operation.currency);
    if (folioBalanceUnits < operation.amount) {
      await this.requireReconciliation(operation, 'Current Folio balance is below the provider-confirmed capture; no overpayment was posted.');
      return;
    }
    if (folio.status !== 'OPEN' || !reservation || reservation.status !== 'CHECKED_IN') {
      await this.requireReconciliation(operation, 'Existing FolioService rules require an OPEN Folio and CHECKED_IN reservation; no settlement was posted.');
      return;
    }
    try {
      const payment = await this.folioService.recordPayment(propertyId, operation.folioId, {
        amount: minorUnitsToFolioAmount(operation.amount, operation.currency), paymentMethod: PaymentMethod.CREDIT_CARD,
        referenceNumber: operation.providerReference || operation.gatewayTransactionId,
      } as RecordPaymentDto, this.recoveredActor(operation), key);
      const replay = await this.prisma.payment.findUnique({ where: { uq_payment_property_idempotency: { propertyId, idempotencyKey: key } } });
      if (!replay || replay.id !== payment.id || replay.folioId !== operation.folioId || replay.payloadHash !== this.paymentPayloadHash(operation.folioId, expectedPayment)) {
        throw new ConflictException('Folio payment idempotency did not resolve to the expected capture settlement.');
      }
      await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'SETTLED', folioPaymentId: payment.id, settledAt: new Date(), reconciliationReason: null, failureCode: null, failureMessage: null } });
    } catch (error) {
      const persisted = await this.prisma.payment.findUnique({ where: { uq_payment_property_idempotency: { propertyId, idempotencyKey: key } } });
      if (persisted && persisted.folioId === operation.folioId && persisted.payloadHash === this.paymentPayloadHash(operation.folioId, expectedPayment)) {
        await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'SETTLED', folioPaymentId: persisted.id, settledAt: new Date(), reconciliationReason: null, failureCode: null, failureMessage: null } });
        return;
      }
      const folio = await this.prisma.folio.findFirst({ where: { propertyId, id: operation.folioId } });
      const reservation = operation.reservationId ? await this.prisma.reservation.findFirst({ where: { propertyId, id: operation.reservationId } }) : null;
      if (folio?.status === 'CLOSED') {
        await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'REQUIRES_RECONCILIATION', reconciliationReason: 'Provider capture confirmed after Folio close; Folio was not reopened or refunded.', failureCode: 'FOLIO_CLOSED_AFTER_CAPTURE', failureMessage: 'Authorized reconciliation decision required.' } });
        return;
      }
      if (folio?.status === 'OPEN' && reservation?.status !== 'CHECKED_IN') {
        await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'REQUIRES_RECONCILIATION', reconciliationReason: 'Reservation is not CHECKED_IN; existing FolioService acceptance rules prohibit payment posting.', failureCode: 'RESERVATION_NOT_CHECKED_IN', failureMessage: 'Manual reconciliation required.' } });
        return;
      }
      await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'SETTLEMENT_PENDING', reconciliationReason: 'Retry FolioService with this operation’s same stable idempotency key.', failureCode: 'FOLIO_SETTLEMENT_PENDING', failureMessage: this.safeError(error) } });
      throw error;
    }
  }

  private async confirmRefund(operation: any, result: any, reason: string): Promise<void> {
    const updated = await this.prisma.paymentGatewayOperation.updateMany({
      where: { id: operation.id, state: 'PROVIDER_PENDING', providerConfirmedAt: null },
      data: {
        state: 'PROVIDER_CONFIRMED', providerReference: result.externalId,
        providerResult: safeProviderResult(result), providerConfirmedAt: new Date(), reason,
      },
    });
    if (updated.count !== 1) throw new ConflictException('Refund operation state changed before provider confirmation could be persisted.');
    const confirmed = await this.readOperation(operation.propertyId, operation.id);
    if (!confirmed?.providerConfirmedAt || confirmed.providerReference !== result.externalId) {
      throw new ConflictException('Provider refund confirmation could not be durably recorded.');
    }
    await this.applyConfirmedRefundToGatewayTransaction(confirmed);
  }

  private async applyConfirmedRefundToGatewayTransaction(operation: any): Promise<void> {
    if (operation.transactionAppliedAt) return;
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.paymentGatewayOperation.findFirst({ where: { propertyId: operation.propertyId, id: operation.id } });
      if (!current?.providerConfirmedAt) throw new ConflictException('Provider refund confirmation is not durable.');
      if (current.transactionAppliedAt) return;
      const changed = await tx.paymentGatewayTransaction.updateMany({ where: { propertyId: operation.propertyId, id: operation.gatewayTransactionId, pendingRefundAmount: { gte: operation.amount } }, data: {
        pendingRefundAmount: { decrement: operation.amount }, refundedAmount: { increment: operation.amount }, version: { increment: 1 },
      } });
      if (changed.count !== 1) throw new ConflictException('Refund reservation could not be finalized.');
      const transaction = await tx.paymentGatewayTransaction.findFirst({ where: { propertyId: operation.propertyId, id: operation.gatewayTransactionId } });
      if (transaction && transaction.capturedAmount > 0 && transaction.refundedAmount >= transaction.capturedAmount) {
        await tx.paymentGatewayTransaction.updateMany({ where: { propertyId: operation.propertyId, id: operation.gatewayTransactionId }, data: { status: 'REFUNDED' } });
      } else {
        await tx.paymentGatewayTransaction.updateMany({ where: { propertyId: operation.propertyId, id: operation.gatewayTransactionId }, data: { status: 'PARTIALLY_REFUNDED' } });
      }
      await tx.paymentGatewayOperation.update({ where: { id: operation.id }, data: { transactionAppliedAt: new Date() } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 });
  }

  private async settleRefund(propertyId: string, operationId: string, reason: string): Promise<void> {
    let operation = await this.readOperation(propertyId, operationId);
    if (!operation || operation.operationType !== 'REFUND' || !operation.providerConfirmedAt) throw new ConflictException('Refund is not provider-confirmed.');
    if (operation.state === 'FAILED') throw new ConflictException('Failed refund operations are immutable and cannot be settled.');
    if (operation.state === 'REQUIRES_RECONCILIATION') {
      throw new ConflictException('Refund requires authorized manual reconciliation and cannot be automatically retried.');
    }
    reason = operation.reason || reason;
    await this.applyConfirmedRefundToGatewayTransaction(operation);
    operation = await this.readOperation(propertyId, operationId);
    if (operation.state === 'PROVIDER_CONFIRMED') {
      await this.prisma.paymentGatewayOperation.updateMany({ where: { id: operation.id, state: 'PROVIDER_CONFIRMED' }, data: { state: 'SETTLEMENT_PENDING' } });
      operation = await this.readOperation(propertyId, operationId);
    }
    if (operation.state === 'SETTLED') return;
    if (operation.folioTransactionId) {
      const persisted = await this.prisma.folioTransaction.findFirst({ where: { propertyId, id: operation.folioTransactionId, folioId: operation.folioId } });
      const expectedCharge: PostChargeDto = {
        transactionCode: 'GATEWAY_REFUND', description: `Gateway refund: ${reason}`.slice(0, 255),
        amount: minorUnitsToFolioAmount(operation.amount, operation.currency), reasonCode: 'GATEWAY_REFUND', taxAmount: '0.0000',
      };
      if (persisted?.payloadHash === this.chargePayloadHash(operation.folioId, expectedCharge)) {
        await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'SETTLED', settledAt: operation.settledAt || new Date(), reconciliationReason: null } });
        return;
      }
      await this.requireReconciliation(operation, 'Saved Folio transaction link does not match the confirmed refund payload.');
      return;
    }
    if (!operation.folioId || !operation.reservationId || !operation.originalPaymentId || !operation.gatewayTransactionId) {
      await this.requireReconciliation(operation, 'Provider refund confirmed but the original Folio/payment relationship is incomplete.');
      return;
    }
    const key = this.folioRefundKey(operation.id);
    const expectedCharge: PostChargeDto = {
      transactionCode: 'GATEWAY_REFUND', description: `Gateway refund: ${reason}`.slice(0, 255),
      amount: minorUnitsToFolioAmount(operation.amount, operation.currency), reasonCode: 'GATEWAY_REFUND', taxAmount: '0.0000',
    };
    const previouslyPosted = await this.prisma.folioTransaction.findUnique({ where: { uq_folio_tx_property_idempotency: { propertyId, idempotencyKey: key } } });
    if (previouslyPosted) {
      if (previouslyPosted.folioId === operation.folioId && previouslyPosted.payloadHash === this.chargePayloadHash(operation.folioId, expectedCharge)) {
        await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'SETTLED', folioTransactionId: previouslyPosted.id, settledAt: new Date(), reconciliationReason: null, failureCode: null, failureMessage: null } });
        return;
      }
      await this.requireReconciliation(operation, 'Existing Folio refund entry with the operation key does not match the provider-confirmed refund.');
      return;
    }
    if (operation.folioTransactionId) {
      const existingEntry = await this.prisma.folioTransaction.findFirst({ where: { propertyId, id: operation.folioTransactionId, folioId: operation.folioId } });
      if (existingEntry) {
        if (existingEntry.payloadHash !== this.chargePayloadHash(operation.folioId, expectedCharge)) {
          await this.requireReconciliation(operation, 'Linked Folio refund transaction conflicts with provider-confirmed refund details.');
          return;
        }
        await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'SETTLED', settledAt: operation.settledAt || new Date(), reconciliationReason: null } });
        return;
      }
    }
    const existingAdjustment = await this.prisma.paymentAdjustment.findFirst({ where: { propertyId, refundOperationId: operation.id } });
    if (existingAdjustment) {
      const expectedAmount = new Prisma.Decimal(minorUnitsToFolioAmount(operation.amount, operation.currency));
      if (existingAdjustment.amount.toString() !== expectedAmount.toString()
        || existingAdjustment.originalPaymentId !== operation.originalPaymentId
        || existingAdjustment.folioId !== operation.folioId
        || existingAdjustment.reservationId !== operation.reservationId
        || existingAdjustment.gatewayTransactionId !== operation.gatewayTransactionId
        || existingAdjustment.currency.toUpperCase() !== operation.currency.toUpperCase()) {
        await this.requireReconciliation(operation, 'Existing immutable refund adjustment conflicts with provider-confirmed operation details.');
        return;
      }
      await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'SETTLED', settledAt: operation.settledAt || new Date(), reconciliationReason: null } });
      return;
    }
    const folio = await this.prisma.folio.findFirst({ where: { propertyId, id: operation.folioId } });
    const reservation = await this.prisma.reservation.findFirst({ where: { propertyId, id: operation.reservationId } });
    if (!folio || !reservation) throw new NotFoundException('Refund Folio or reservation not found for property.');
    if (folio.currency.toUpperCase() !== operation.currency.toUpperCase()) {
      await this.requireReconciliation(operation, 'Gateway and Folio currencies differ; refund adjustment currency is not inferred.');
      return;
    }
    if (folio.status === 'OPEN' && reservation.status === 'CHECKED_IN') {
      const dto: PostChargeDto = {
        transactionCode: 'GATEWAY_REFUND', description: `Gateway refund: ${reason}`.slice(0, 255),
        amount: minorUnitsToFolioAmount(operation.amount, operation.currency), reasonCode: 'GATEWAY_REFUND', taxAmount: '0.0000',
      };
      try {
        const transaction = await this.folioService.postCharge(propertyId, operation.folioId, dto, this.recoveredActor(operation), key);
        const persisted = await this.prisma.folioTransaction.findUnique({ where: { uq_folio_tx_property_idempotency: { propertyId, idempotencyKey: key } } });
        if (!persisted || persisted.id !== transaction.id || persisted.folioId !== operation.folioId || persisted.payloadHash !== this.chargePayloadHash(operation.folioId, dto)) {
          throw new ConflictException('Folio refund idempotency did not resolve to the expected append-only entry.');
        }
        await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'SETTLED', folioTransactionId: transaction.id, settledAt: new Date(), reconciliationReason: null, failureCode: null, failureMessage: null } });
        return;
      } catch (error) {
        const alreadyPosted = await this.prisma.folioTransaction.findFirst({ where: { propertyId, idempotencyKey: key } });
        const expectedCharge: PostChargeDto = {
          transactionCode: 'GATEWAY_REFUND', description: `Gateway refund: ${reason}`.slice(0, 255),
          amount: minorUnitsToFolioAmount(operation.amount, operation.currency), reasonCode: 'GATEWAY_REFUND', taxAmount: '0.0000',
        };
        if (alreadyPosted && alreadyPosted.folioId === operation.folioId && alreadyPosted.payloadHash === this.chargePayloadHash(operation.folioId, expectedCharge)) {
          await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'SETTLED', folioTransactionId: alreadyPosted.id, settledAt: new Date(), reconciliationReason: null, failureCode: null, failureMessage: null } });
          return;
        }
        const currentFolio = await this.prisma.folio.findFirst({ where: { propertyId, id: operation.folioId } });
        if (currentFolio?.status !== 'CLOSED') {
          await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'REQUIRES_RECONCILIATION', reconciliationReason: 'Provider refund confirmed but FolioService append-only charge failed.', failureCode: 'FOLIO_REFUND_SETTLEMENT_FAILED', failureMessage: this.safeError(error) } });
          return;
        }
      }
    } else if (folio.status !== 'CLOSED') {
      await this.requireReconciliation(operation, 'Folio is OPEN but reservation is not CHECKED_IN; no Folio entry or adjustment was guessed.');
      return;
    }
    await this.createAdjustment(operation, reason);
  }

  private async createAdjustment(operation: any, reason: string): Promise<void> {
    const idempotencyKey = `refund-adjustment:${operation.id}`.slice(0, 64);
    try {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.paymentGatewayOperation.findFirst({ where: { propertyId: operation.propertyId, id: operation.id } });
        if (!current?.providerConfirmedAt || current.state === 'FAILED' || current.state === 'REQUIRES_RECONCILIATION') {
          throw new ConflictException('Refund operation is not eligible for automatic adjustment settlement.');
        }
        const existing = await tx.paymentAdjustment.findFirst({ where: { propertyId: operation.propertyId, refundOperationId: operation.id } });
        if (existing) {
          const expected = new Prisma.Decimal(minorUnitsToFolioAmount(operation.amount, operation.currency));
          if (existing.amount.toString() !== expected.toString() || existing.originalPaymentId !== operation.originalPaymentId || existing.folioId !== operation.folioId || existing.reservationId !== operation.reservationId || existing.gatewayTransactionId !== operation.gatewayTransactionId || existing.currency.toUpperCase() !== operation.currency.toUpperCase() || existing.actorId !== operation.actorId) {
            throw new ConflictException('Existing refund adjustment conflicts with provider-confirmed refund.');
          }
        } else await tx.paymentAdjustment.create({ data: {
          id: generateUuidV7(), propertyId: operation.propertyId, folioId: operation.folioId,
          reservationId: operation.reservationId, originalPaymentId: operation.originalPaymentId,
          gatewayTransactionId: operation.gatewayTransactionId, refundOperationId: operation.id,
          currency: operation.currency, amount: new Prisma.Decimal(minorUnitsToFolioAmount(operation.amount, operation.currency)),
            reason: reason.slice(0, 255), idempotencyKey, actorId: operation.actorId,
        } });
        await tx.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'SETTLED', settledAt: new Date(), reconciliationReason: null, failureCode: null, failureMessage: null } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const duplicate = await this.prisma.paymentAdjustment.findFirst({ where: { propertyId: operation.propertyId, refundOperationId: operation.id } });
        if (duplicate) {
          const expected = new Prisma.Decimal(minorUnitsToFolioAmount(operation.amount, operation.currency));
          if (duplicate.amount.toString() !== expected.toString() || duplicate.originalPaymentId !== operation.originalPaymentId || duplicate.folioId !== operation.folioId || duplicate.reservationId !== operation.reservationId || duplicate.gatewayTransactionId !== operation.gatewayTransactionId || duplicate.currency.toUpperCase() !== operation.currency.toUpperCase() || duplicate.actorId !== operation.actorId) {
            await this.requireReconciliation(operation, 'Duplicate adjustment conflicts with provider-confirmed refund.');
            throw new ConflictException('Duplicate refund adjustment conflicts with provider-confirmed amount.');
          }
          await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'SETTLED', settledAt: new Date() } });
          return;
        }
      }
      await this.requireReconciliation(operation, 'Provider refund confirmed but immutable adjustment persistence failed.');
      throw error;
    }
  }

  private async capturedFolioPayments(propertyId: string, transaction: any): Promise<any[]> {
    const captureOperations = await this.prisma.paymentGatewayOperation.findMany({
      where: { propertyId, gatewayTransactionId: transaction.id, operationType: 'CAPTURE', folioPaymentId: { not: null } },
      select: { folioPaymentId: true },
    });
    const paymentIds = captureOperations.map((operation) => operation.folioPaymentId).filter((id): id is string => Boolean(id));
    if (!paymentIds.length) return [];
    return this.prisma.payment.findMany({ where: { propertyId, id: { in: paymentIds } }, orderBy: { processedAt: 'asc' } });
  }

  private async capturedAmountForPayment(propertyId: string, transactionId: string, paymentId: string): Promise<number> {
    const captures = await this.prisma.paymentGatewayOperation.findMany({
      where: { propertyId, gatewayTransactionId: transactionId, operationType: 'CAPTURE', folioPaymentId: paymentId, providerConfirmedAt: { not: null } },
      select: { amount: true },
    });
    return captures.reduce((total, operation) => total + operation.amount, 0);
  }

  private async refundedAmountForPayment(propertyId: string, transactionId: string, paymentId: string): Promise<number> {
    const refunds = await this.prisma.paymentGatewayOperation.findMany({
      where: { propertyId, gatewayTransactionId: transactionId, operationType: 'REFUND', originalPaymentId: paymentId, providerConfirmedAt: { not: null } },
      select: { amount: true },
    });
    return refunds.reduce((total, operation) => total + operation.amount, 0);
  }

  private async folioForTransaction(propertyId: string, transaction: any): Promise<{ folioId: string; reservationId: string } | null> {
    if (!transaction.paymentIntentId) return null;
    const intent = await this.prisma.paymentIntent.findFirst({ where: { propertyId, id: transaction.paymentIntentId } });
    if (!intent?.folioId) return null;
    const folio = await this.prisma.folio.findFirst({ where: { propertyId, id: intent.folioId } });
    return folio ? { folioId: folio.id, reservationId: folio.reservationId } : null;
  }

  private async requireDemoConfig(propertyId: string, id: string): Promise<any> {
    const config = await this.prisma.paymentProviderConfig.findFirst({ where: { propertyId, id, deletedAt: null } });
    if (!config) throw new NotFoundException('Payment provider configuration not found for property.');
    if (!config.enabled || config.provider !== 'DEMO') throw new BadRequestException('Only the enabled DEMO adapter is executable.');
    return config;
  }

  private async markProviderPending(id: string): Promise<void> {
    const updated = await this.prisma.paymentGatewayOperation.updateMany({ where: { id, state: 'REQUESTED' }, data: { state: 'PROVIDER_PENDING', providerStartedAt: new Date() } });
    if (updated.count !== 1) throw new ConflictException('Operation is already being processed or requires reconciliation.');
  }

  private async markAuthorizationPending(propertyId: string, intentId: string, operationId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const intent = await tx.paymentIntent.updateMany({
        where: { propertyId, id: intentId, status: { in: ['REQUIRES_PAYMENT_METHOD', 'REQUIRES_CONFIRMATION', 'REQUIRES_ACTION'] } },
        data: { status: 'PROCESSING', version: { increment: 1 } },
      });
      if (intent.count !== 1) throw new ConflictException('Payment intent is already being authorized or is no longer authorizable.');
      const operation = await tx.paymentGatewayOperation.updateMany({
        where: { id: operationId, propertyId, state: 'REQUESTED' },
        data: { state: 'PROVIDER_PENDING', providerStartedAt: new Date() },
      });
      if (operation.count !== 1) throw new ConflictException('Authorization operation is already being processed or requires reconciliation.');
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 });
  }

  private async failOperation(id: string, code: string, message: string): Promise<never> {
    const operation = await this.prisma.paymentGatewayOperation.findUnique({ where: { id } });
    if (!operation) throw new NotFoundException('Payment operation not found.');
    await this.prisma.$transaction(async (tx) => {
      if (operation.gatewayTransactionId && operation.operationType === 'CAPTURE') await tx.paymentGatewayTransaction.updateMany({ where: { propertyId: operation.propertyId, id: operation.gatewayTransactionId, pendingCaptureAmount: { gte: operation.amount } }, data: { pendingCaptureAmount: { decrement: operation.amount }, version: { increment: 1 } } });
      if (operation.gatewayTransactionId && operation.operationType === 'REFUND') await tx.paymentGatewayTransaction.updateMany({ where: { propertyId: operation.propertyId, id: operation.gatewayTransactionId, pendingRefundAmount: { gte: operation.amount } }, data: { pendingRefundAmount: { decrement: operation.amount }, version: { increment: 1 } } });
      await tx.paymentGatewayOperation.update({ where: { id }, data: { state: 'FAILED', failureCode: code, failureMessage: message, failedAt: new Date() } });
    });
    throw new BadRequestException(message);
  }

  private async markUnknown(id: string, reason: string): Promise<void> {
    await this.prisma.paymentGatewayOperation.updateMany({ where: { id, state: { not: 'SETTLED' } }, data: {
      state: 'REQUIRES_RECONCILIATION', reconciliationReason: reason,
      failureCode: 'PROVIDER_OUTCOME_UNKNOWN', failureMessage: 'Provider outcome requires authoritative reconciliation.',
    } });
  }

  private async requireReconciliation(operation: any, reason: string): Promise<void> {
    await this.prisma.paymentGatewayOperation.update({ where: { id: operation.id }, data: { state: 'REQUIRES_RECONCILIATION', reconciliationReason: reason, failureCode: 'SETTLEMENT_REQUIRES_RECONCILIATION', failureMessage: reason } });
  }

  private async readOperation(propertyId: string, id: string): Promise<any | null> {
    return this.prisma.paymentGatewayOperation.findFirst({ where: { id, propertyId } });
  }

  private async gatewayTransaction(propertyId: string, id?: string | null): Promise<any> {
    if (!id) throw new ConflictException('Gateway transaction has not been persisted yet.');
    const row = await this.prisma.paymentGatewayTransaction.findFirst({ where: { propertyId, id } });
    if (!row) throw new NotFoundException('Gateway transaction not found for property.');
    return row;
  }

  private recoveredActor(operation: any): SecurityContext {
    const snapshot = operation.actorSnapshot as any;
    if (!snapshot?.user || !snapshot?.roles || !Array.isArray(snapshot?.scopes)) {
      throw new ConflictException('Persisted authenticated actor context is unavailable; automated settlement is disabled.');
    }
    return {
      ...snapshot, userId: operation.actorId,
      sessionId: `payment-operation:${operation.id}`, correlationId: `payment-operation:${operation.id}`,
      activeContext: { hotelGroupId: operation.actorHotelGroupId || null, propertyId: operation.propertyId },
      permissions: new Set<string>(snapshot.permissions || []),
    } as SecurityContext;
  }

  private assertActorProperty(propertyId: string, actor: SecurityContext): void {
    if (!actor?.userId || actor.activeContext.propertyId !== propertyId) throw new BadRequestException('Validated security context must match the property.');
  }

  private actorSnapshot(actor: SecurityContext): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify({ user: actor.user, isGlobalAdmin: actor.isGlobalAdmin, roles: actor.roles, permissions: [...actor.permissions], scopes: actor.scopes, activeContext: actor.activeContext })) as Prisma.InputJsonValue;
  }

  private idempotencyKey(value: string | undefined, requestHash: string): string {
    const key = value?.trim();
    if (!key) throw new BadRequestException('Idempotency-Key is required for every financial operation.');
    if (key.length > 64) throw new BadRequestException('Idempotency key may not exceed 64 characters.');
    return key;
  }

  private assertAmount(value: number): void {
    if (!Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647) throw new BadRequestException('Amount must be a positive 32-bit safe integer in currency minor units.');
  }

  private folioPaymentKey(operationId: string): string { return `gateway-payment:${operationId}`.slice(0, 64); }
  private folioRefundKey(operationId: string): string { return `gateway-refund:${operationId}`.slice(0, 64); }

  private safeError(error: unknown): string {
    return error instanceof Error ? error.message.replace(/((?:secret|token|password|credential)\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]').slice(0, 1000) : 'Settlement failed.';
  }
}
