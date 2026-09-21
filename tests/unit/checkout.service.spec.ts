import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CheckoutService } from '../../apps/api-core/src/modules/pms/finance/services/checkout.service';
import { FolioStatus, ReservationStatus, SecurityContext } from '@hms/api-contracts';

describe('CheckoutService (W1-T08 Departure Checkout & Folio Settlement)', () => {
  let service: CheckoutService;
  let mockPrisma: any;
  let mockRoomStatusService: any;

  const propertyId = '01a00000-0000-7000-0000-000000000001';
  const reservationId = '01a00000-0000-7000-0000-000000000004';
  const roomId = '01a00000-0000-7000-0000-000000000010';
  const folioId = '01a00000-0000-7000-0000-000000000050';
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
      email: 'frontdesk@example.com',
      firstName: 'Front',
      lastName: 'Desk',
      status: 'ACTIVE',
    },
    isGlobalAdmin: false,
    roles: Object.freeze([]),
    permissions: new Set(['frontdesk:checkout', 'folio:view']),
    scopes: Object.freeze([]),
  };

  beforeEach(() => {
    mockPrisma = {
      reservation: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({
          id: reservationId,
          propertyId,
          confirmationNumber: 'RES-001',
          status: ReservationStatus.CHECKED_IN,
          assignedRoomId: roomId,
          arrivalDate: new Date('2026-09-20T00:00:00.000Z'),
          departureDate: new Date('2026-09-22T00:00:00.000Z'),
          adultsCount: 2,
          childrenCount: 0,
          totalAmount: 300,
          currency: 'USD',
          version: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
          roomType: { code: 'STD', name: 'Standard Room' },
          assignedRoom: {
            id: roomId,
            propertyId,
            roomNumber: '101',
            isActive: true,
          },
          guest: {
            id: 'guest-1',
            firstName: 'John',
            lastName: 'Doe',
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockImplementation(() =>
          Promise.resolve({
            id: reservationId,
            propertyId,
            confirmationNumber: 'RES-001',
            status: ReservationStatus.CHECKED_OUT,
            assignedRoomId: roomId,
            arrivalDate: new Date('2026-09-20T00:00:00.000Z'),
            departureDate: new Date('2026-09-22T00:00:00.000Z'),
            adultsCount: 2,
            childrenCount: 0,
            totalAmount: 300,
            currency: 'USD',
            version: 3,
            checkOutAt: new Date(),
            checkedOutBy: actorId,
            createdAt: new Date(),
            updatedAt: new Date(),
            roomType: { code: 'STD', name: 'Standard Room' },
            assignedRoom: {
              id: roomId,
              propertyId,
              roomNumber: '101',
              isActive: true,
            },
            guest: {
              id: 'guest-1',
              firstName: 'John',
              lastName: 'Doe',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          }),
        ),
      },
      folio: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: folioId,
            propertyId,
            reservationId,
            folioNumber: 'F-1001',
            status: FolioStatus.OPEN,
            currency: 'USD',
            balance: new Prisma.Decimal('0.0000'),
            version: 1,
            transactions: [
              {
                id: 'tx-1',
                amount: new Prisma.Decimal('200.0000'),
                taxAmount: new Prisma.Decimal('20.0000'),
              },
            ],
            payments: [
              {
                id: 'pay-1',
                amount: new Prisma.Decimal('200.0000'),
              },
            ],
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    mockRoomStatusService = {
      findById: jest.fn().mockResolvedValue({
        roomId,
        propertyId,
        roomNumber: '101',
        housekeepingStatus: 'DIRTY',
        serviceStatus: 'IN_SERVICE',
        occupancyStatus: 'VACANT',
        version: 3,
        effective: { isCheckInReady: false, isSellable: false },
      }),
      departRoom: jest.fn().mockResolvedValue({
        room: {
          id: roomId,
          propertyId,
          roomNumber: '101',
          housekeepingStatus: 'DIRTY',
          serviceStatus: 'IN_SERVICE',
          occupancyStatus: 'VACANT',
          version: 3,
        },
        effective: {
          isCheckInReady: false,
          serviceStatus: 'IN_SERVICE',
          housekeepingStatus: 'DIRTY',
          occupancyStatus: 'VACANT',
          isSellable: false,
        },
      }),
    };

    service = new CheckoutService(mockPrisma, mockRoomStatusService);
  });

  describe('STRICT ZERO-BALANCE Policy', () => {
    it('successfully checks out when all folios have balance = 0.0000', async () => {
      const res = await service.checkout(propertyId, reservationId, actorContext, 'checkout-key-1');

      expect(res.reservation.status).toBe(ReservationStatus.CHECKED_OUT);
      expect(mockRoomStatusService.departRoom).toHaveBeenCalledWith(
        propertyId,
        roomId,
        expect.objectContaining({ actorId }),
        expect.anything(),
      );
      // Explicit OCC close on folio
      expect(mockPrisma.folio.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: folioId,
            version: 1,
            status: FolioStatus.OPEN,
          },
          data: expect.objectContaining({
            status: FolioStatus.CLOSED,
            closedBy: actorId,
          }),
        }),
      );
      // Outbox events emitted for GUEST_CHECKED_OUT and FOLIO_CLOSED
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledTimes(2);
    });

    it('rejects checkout when folio balance > 0 (unsettled debt)', async () => {
      mockPrisma.folio.findMany.mockResolvedValueOnce([
        {
          id: folioId,
          propertyId,
          reservationId,
          folioNumber: 'F-1001',
          status: FolioStatus.OPEN,
          currency: 'USD',
          balance: new Prisma.Decimal('50.0000'),
          version: 1,
          transactions: [{ amount: new Prisma.Decimal('150.0000') }],
          payments: [{ amount: new Prisma.Decimal('100.0000') }],
        },
      ]);

      await expect(
        service.checkout(propertyId, reservationId, actorContext, 'checkout-key-2'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects checkout when folio balance < 0 (guest credit / overpayment deferred rule)', async () => {
      mockPrisma.folio.findMany.mockResolvedValueOnce([
        {
          id: folioId,
          propertyId,
          reservationId,
          folioNumber: 'F-1001',
          status: FolioStatus.OPEN,
          currency: 'USD',
          balance: new Prisma.Decimal('-25.0000'),
          version: 1,
          transactions: [{ amount: new Prisma.Decimal('75.0000') }],
          payments: [{ amount: new Prisma.Decimal('100.0000') }],
        },
      ]);

      await expect(
        service.checkout(propertyId, reservationId, actorContext, 'checkout-key-3'),
      ).rejects.toThrow(ConflictException);
    });

    it('allows checkout when reservation has no open folios (no charges were posted)', async () => {
      mockPrisma.folio.findMany.mockResolvedValueOnce([]);

      const res = await service.checkout(propertyId, reservationId, actorContext, 'checkout-key-4');

      expect(res.reservation.status).toBe(ReservationStatus.CHECKED_OUT);
      expect(res.foliosSummary).toHaveLength(0);
    });
  });

  describe('Preconditions and Error Handling', () => {
    it('rejects checkout if Idempotency-Key is missing or empty', async () => {
      await expect(service.checkout(propertyId, reservationId, actorContext, '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects checkout if reservation is not in CHECKED_IN status (e.g. CONFIRMED)', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-001',
        status: ReservationStatus.CONFIRMED,
        assignedRoomId: roomId,
      });

      await expect(
        service.checkout(propertyId, reservationId, actorContext, 'key-not-checked-in'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects checkout if reservation is already CHECKED_OUT (without matching idempotency key)', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-001',
        status: ReservationStatus.CHECKED_OUT,
        assignedRoomId: roomId,
      });

      await expect(
        service.checkout(propertyId, reservationId, actorContext, 'key-already-out'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects checkout if reservation has no assigned room', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-001',
        status: ReservationStatus.CHECKED_IN,
        assignedRoomId: null,
      });

      await expect(
        service.checkout(propertyId, reservationId, actorContext, 'key-no-room'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 500 BALANCE_INTEGRITY_VIOLATION if materialized balance deviates from sum of transactions and payments', async () => {
      mockPrisma.folio.findMany.mockResolvedValueOnce([
        {
          id: folioId,
          propertyId,
          reservationId,
          folioNumber: 'F-1001',
          status: FolioStatus.OPEN,
          currency: 'USD',
          balance: new Prisma.Decimal('0.0000'), // Materialized says 0
          version: 1,
          transactions: [{ amount: new Prisma.Decimal('100.0000') }],
          payments: [{ amount: new Prisma.Decimal('80.0000') }], // Actual sum is +20!
        },
      ]);

      await expect(
        service.checkout(propertyId, reservationId, actorContext, 'key-corrupt-balance'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('Explicit OCC and Concurrency Races', () => {
    it('throws 409 OCC_CONFLICT and rolls back if a concurrent charge/payment increments Folio version before closure', async () => {
      // Simulate race condition: updateMany on Folio returns 0 affected rows because concurrent payment incremented version
      mockPrisma.folio.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.checkout(propertyId, reservationId, actorContext, 'race-test-key'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 409 OCC_CONFLICT if reservation version changes concurrently', async () => {
      mockPrisma.reservation.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.checkout(propertyId, reservationId, actorContext, 'res-race-key'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Idempotency Semantics', () => {
    it('Case A: returns previous checkout result on idempotent retry with same key', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-001',
        status: ReservationStatus.CHECKED_OUT,
        assignedRoomId: roomId,
        checkOutIdempotencyKey: 'checkout-key-1',
        checkOutPayloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // sha256('')
        arrivalDate: new Date('2026-09-20T00:00:00.000Z'),
        departureDate: new Date('2026-09-22T00:00:00.000Z'),
        checkOutAt: new Date('2026-09-22T11:00:00.000Z'),
        checkedOutBy: actorId,
        version: 3,
        totalAmount: 300,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        roomType: { code: 'STD' },
        assignedRoom: { roomNumber: '101' },
      });

      const res = await service.checkout(propertyId, reservationId, actorContext, 'checkout-key-1');

      expect(res.reservation.status).toBe(ReservationStatus.CHECKED_OUT);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('Case B: rejects with 409 if same idempotency key is reused for a different reservation', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValueOnce({
        id: 'different-res-id',
        propertyId,
        checkOutIdempotencyKey: 'checkout-key-1',
      });

      await expect(
        service.checkout(propertyId, reservationId, actorContext, 'checkout-key-1'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
