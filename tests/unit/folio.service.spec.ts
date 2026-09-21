import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  FolioService,
  computeChargePayloadHash,
  computePaymentPayloadHash,
} from '../../apps/api-core/src/modules/pms/finance/services/folio.service';
import {
  FolioStatus,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
  SecurityContext,
} from '@hms/api-contracts';

describe('FolioService (W1-T08 Finance, Folios, Charges & Payments)', () => {
  let service: FolioService;
  let mockPrisma: any;

  const propertyId = '01a00000-0000-7000-0000-000000000001';
  const reservationId = '01a00000-0000-7000-0000-000000000004';
  const folioId = '01a00000-0000-7000-0000-000000000050';
  const guestId = '01a00000-0000-7000-0000-000000000060';
  const actorId = '01a00000-0000-7000-0000-000000000099';

  const actorContext: SecurityContext = {
    userId: actorId,
    sessionId: 'session-1',
    correlationId: 'corr-1',
    activeContext: {
      hotelGroupId: '01a00000-0000-7000-0000-000000000000',
      propertyId,
    },
    user: {
      id: actorId,
      email: 'cashier@example.com',
      firstName: 'Finance',
      lastName: 'Agent',
      status: 'ACTIVE',
    },
    isGlobalAdmin: false,
    roles: Object.freeze([]),
    permissions: new Set(['folio:view', 'folio:post_charge', 'folio:post_payment', 'folio:rebate']),
    scopes: Object.freeze([]),
  };

  beforeEach(() => {
    mockPrisma = {
      folio: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({
          id: folioId,
          tenantId: '01a00000-0000-7000-0000-000000000000',
          propertyId,
          reservationId,
          guestId,
          folioNumber: 'F-1001',
          status: FolioStatus.OPEN,
          currency: 'USD',
          balance: new Prisma.Decimal(0),
          idempotencyKey: 'folio-key-1',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: actorId,
          closedAt: null,
          closedBy: null,
        }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      reservation: {
        findFirst: jest.fn().mockResolvedValue({
          id: reservationId,
          propertyId,
          confirmationNumber: 'RES-001',
          status: ReservationStatus.CHECKED_IN,
          currency: 'USD',
          guestId,
          deletedAt: null,
        }),
      },
      folioTransaction: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...data,
            id: 'tx-1',
          }),
        ),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...data,
            id: 'pay-1',
          }),
        ),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    service = new FolioService(mockPrisma);
  });

  describe('createFolio', () => {
    it('creates a new folio for checked-in reservation with mandatory idempotency key', async () => {
      const res = await service.createFolio(
        propertyId,
        { reservationId, folioNumber: 'F-001' },
        actorContext,
        'create-key-1',
      );

      expect(res.folioNumber).toBe('F-001');
      expect(res.status).toBe(FolioStatus.OPEN);
      expect(res.currency).toBe('USD');
      expect(res.balance).toBe('0.0000');
      expect(mockPrisma.folio.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reservationId,
            idempotencyKey: 'create-key-1',
            status: FolioStatus.OPEN,
          }),
        }),
      );
    });

    it('rejects folio creation if Idempotency-Key is missing or empty', async () => {
      await expect(
        service.createFolio(propertyId, { reservationId }, actorContext, ''),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createFolio(propertyId, { reservationId }, actorContext, '   '),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns existing folio on idempotent retry with same key and reservationId', async () => {
      mockPrisma.folio.findUnique.mockResolvedValueOnce({
        id: folioId,
        propertyId,
        reservationId,
        guestId,
        folioNumber: 'F-001',
        status: FolioStatus.OPEN,
        currency: 'USD',
        balance: new Prisma.Decimal(0),
        idempotencyKey: 'create-key-1',
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: actorId,
        closedAt: null,
        closedBy: null,
      });

      const res = await service.createFolio(
        propertyId,
        { reservationId },
        actorContext,
        'create-key-1',
      );

      expect(res.id).toBe(folioId);
      expect(mockPrisma.folio.create).not.toHaveBeenCalled();
    });

    it('rejects if idempotency key is reused for a different reservation', async () => {
      mockPrisma.folio.findUnique.mockResolvedValueOnce({
        id: 'other-folio',
        propertyId,
        reservationId: 'different-res',
        idempotencyKey: 'create-key-1',
      });

      await expect(
        service.createFolio(propertyId, { reservationId }, actorContext, 'create-key-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects folio creation if reservation is not CHECKED_IN', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        status: ReservationStatus.CONFIRMED,
      });

      await expect(
        service.createFolio(propertyId, { reservationId }, actorContext, 'key-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('postCharge — Balance Arithmetic & Invariants', () => {
    it('posts debit charge: balance += amount (verifying taxAmount is NOT added on top)', async () => {
      const res = await service.postCharge(
        propertyId,
        folioId,
        {
          transactionCode: 'ROOM_CHARGE',
          description: 'Nightly rate',
          amount: '200.0000',
          taxAmount: '20.0000',
        },
        actorContext,
        'charge-key-1',
      );

      expect(res.amount).toBe('200.0000');
      expect(res.taxAmount).toBe('20.0000');
      // Crucial: Folio balance increment must be exactly 200 (amount), NOT 220 (amount + taxAmount)
      expect(mockPrisma.folio.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            balance: { increment: new Prisma.Decimal('200.0000') },
            version: { increment: 1 },
          }),
        }),
      );
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalled();
    });

    it('posts credit adjustment with mandatory reasonCode: balance decreases', async () => {
      const res = await service.postCharge(
        propertyId,
        folioId,
        {
          transactionCode: 'ALLOWANCE',
          description: 'Service apology credit',
          amount: '-25.0000',
          reasonCode: 'SERVICE_RECOVERY',
        },
        actorContext,
        'credit-key-1',
      );

      expect(res.amount).toBe('-25.0000');
      expect(res.reasonCode).toBe('SERVICE_RECOVERY');
      expect(mockPrisma.folio.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            balance: { increment: new Prisma.Decimal('-25.0000') },
          }),
        }),
      );
    });

    it('rejects credit adjustment if reasonCode is missing or empty', async () => {
      await expect(
        service.postCharge(
          propertyId,
          folioId,
          {
            transactionCode: 'ALLOWANCE',
            description: 'Credit without reason',
            amount: '-10.0000',
          },
          actorContext,
          'credit-key-fail',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects charge if amount is zero', async () => {
      await expect(
        service.postCharge(
          propertyId,
          folioId,
          {
            transactionCode: 'ZERO_CHARGE',
            description: 'Zero test',
            amount: '0.0000',
          },
          actorContext,
          'zero-key',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects charge posting if Idempotency-Key is missing', async () => {
      await expect(
        service.postCharge(
          propertyId,
          folioId,
          {
            transactionCode: 'ROOM_CHARGE',
            description: 'No key test',
            amount: '100.0000',
          },
          actorContext,
          '',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects charge posting to a CLOSED folio', async () => {
      mockPrisma.folio.findFirst.mockResolvedValueOnce({
        id: folioId,
        propertyId,
        folioNumber: 'F-1001',
        status: FolioStatus.CLOSED,
        balance: new Prisma.Decimal(0),
      });

      await expect(
        service.postCharge(
          propertyId,
          folioId,
          {
            transactionCode: 'ROOM_CHARGE',
            description: 'Closed test',
            amount: '50.0000',
          },
          actorContext,
          'closed-key',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('handles OCC conflict on folio balance update during concurrent charge posting', async () => {
      mockPrisma.folio.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.postCharge(
          propertyId,
          folioId,
          {
            transactionCode: 'ROOM_CHARGE',
            description: 'OCC collision test',
            amount: '100.0000',
          },
          actorContext,
          'occ-key',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('returns cached result on idempotent retry with same key and same payload', async () => {
      const chargeDto = {
        transactionCode: 'ROOM_CHARGE',
        description: 'Idempotent test',
        amount: '100.0000',
      };
      const expectedHash = computeChargePayloadHash(folioId, chargeDto);

      mockPrisma.folioTransaction.findUnique.mockResolvedValueOnce({
        id: 'tx-existing',
        propertyId,
        folioId,
        transactionCode: 'ROOM_CHARGE',
        description: 'Idempotent test',
        amount: new Prisma.Decimal('100.0000'),
        taxAmount: new Prisma.Decimal('0.0000'),
        reasonCode: null,
        idempotencyKey: 'idemp-tx-1',
        payloadHash: expectedHash,
        postedAt: new Date(),
        postedBy: actorId,
      });

      const res = await service.postCharge(
        propertyId,
        folioId,
        chargeDto,
        actorContext,
        'idemp-tx-1',
      );

      expect(res.id).toBe('tx-existing');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects with 409 IDEMPOTENCY_PAYLOAD_MISMATCH if same key is submitted with different payload', async () => {
      mockPrisma.folioTransaction.findUnique.mockResolvedValueOnce({
        id: 'tx-existing',
        propertyId,
        folioId,
        idempotencyKey: 'idemp-tx-1',
        payloadHash: 'hash-of-prior-payload',
      });

      await expect(
        service.postCharge(
          propertyId,
          folioId,
          {
            transactionCode: 'ROOM_CHARGE',
            description: 'Different description',
            amount: '150.0000',
          },
          actorContext,
          'idemp-tx-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('recordPayment — Currency & Invariants', () => {
    it('records payment: balance -= amount, currency derived from Folio.currency', async () => {
      const res = await service.recordPayment(
        propertyId,
        folioId,
        {
          amount: '200.0000',
          paymentMethod: PaymentMethod.CASH,
          referenceNumber: 'RECEIPT-01',
        },
        actorContext,
        'pay-key-1',
      );

      expect(res.amount).toBe('200.0000');
      expect(res.currency).toBe('USD'); // Matches Folio currency
      expect(res.paymentMethod).toBe(PaymentMethod.CASH);
      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: 'USD',
            amount: new Prisma.Decimal('200.0000'),
            paymentMethod: PaymentMethod.CASH,
            status: PaymentStatus.COMPLETED,
          }),
        }),
      );
      expect(mockPrisma.folio.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            balance: { decrement: new Prisma.Decimal('200.0000') },
            version: { increment: 1 },
          }),
        }),
      );
    });

    it('rejects payment if amount is zero or negative', async () => {
      await expect(
        service.recordPayment(
          propertyId,
          folioId,
          { amount: '0.0000', paymentMethod: PaymentMethod.CASH },
          actorContext,
          'key-zero-pay',
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.recordPayment(
          propertyId,
          folioId,
          { amount: '-50.0000', paymentMethod: PaymentMethod.CASH },
          actorContext,
          'key-neg-pay',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects payment if Idempotency-Key is missing', async () => {
      await expect(
        service.recordPayment(
          propertyId,
          folioId,
          { amount: '100.0000', paymentMethod: PaymentMethod.CASH },
          actorContext,
          '',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns cached payment on idempotent retry with same key and payload', async () => {
      const payDto = {
        amount: '200.0000',
        paymentMethod: PaymentMethod.CASH,
        referenceNumber: 'REC-01',
      };
      const expectedHash = computePaymentPayloadHash(folioId, payDto);

      mockPrisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-existing',
        propertyId,
        folioId,
        amount: new Prisma.Decimal('200.0000'),
        currency: 'USD',
        paymentMethod: PaymentMethod.CASH,
        referenceNumber: 'REC-01',
        status: PaymentStatus.COMPLETED,
        idempotencyKey: 'pay-key-1',
        payloadHash: expectedHash,
        processedAt: new Date(),
        processedBy: actorId,
      });

      const res = await service.recordPayment(
        propertyId,
        folioId,
        payDto,
        actorContext,
        'pay-key-1',
      );

      expect(res.id).toBe('pay-existing');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects with 409 IDEMPOTENCY_PAYLOAD_MISMATCH on different payment payload', async () => {
      mockPrisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-existing',
        propertyId,
        folioId,
        idempotencyKey: 'pay-key-1',
        payloadHash: 'prior-payment-hash',
      });

      await expect(
        service.recordPayment(
          propertyId,
          folioId,
          {
            amount: '300.0000',
            paymentMethod: PaymentMethod.CREDIT_CARD,
          },
          actorContext,
          'pay-key-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects with 409 if payment idempotency key is reused for a different folio', async () => {
      mockPrisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-existing',
        propertyId,
        folioId: 'different-folio-id',
        idempotencyKey: 'pay-key-1',
        payloadHash: computePaymentPayloadHash('different-folio-id', {
          amount: '100.0000',
          paymentMethod: PaymentMethod.CASH,
        }),
      });

      await expect(
        service.recordPayment(
          propertyId,
          folioId,
          {
            amount: '100.0000',
            paymentMethod: PaymentMethod.CASH,
          },
          actorContext,
          'pay-key-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
