import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CheckInService } from '../../apps/api-core/src/modules/pms/front-office/services/check-in.service';
import { ReservationStatus, SecurityContext } from '@hms/api-contracts';
import * as crypto from 'crypto';

describe('CheckInService (W1-T07 Front Office Guest Check-In)', () => {
  let service: CheckInService;
  let mockPrisma: any;
  let mockBusinessDateService: any;
  let mockRoomStatusService: any;

  const propertyId = '01a00000-0000-7000-0000-000000000001';
  const reservationId = '01a00000-0000-7000-0000-000000000004';
  const roomId = '01a00000-0000-7000-0000-000000000010';
  const actorId = '01a00000-0000-7000-0000-000000000099';

  const baseActorContext: SecurityContext = {
    userId: actorId,
    sessionId: 'session-1',
    correlationId: 'corr-1',
    activeContext: {
      hotelGroupId: null,
      propertyId,
    },
    user: {
      id: actorId,
      email: 'agent@example.com',
      firstName: 'Front',
      lastName: 'Desk',
      status: 'ACTIVE',
    },
    isGlobalAdmin: false,
    roles: Object.freeze([]),
    permissions: new Set(['front_office.checkin.execute']),
    scopes: Object.freeze([]),
  };

  const supervisorActorContext: SecurityContext = {
    ...baseActorContext,
    permissions: new Set(['front_office.checkin.execute', 'front_office.checkin.clean_override']),
  };

  beforeEach(() => {
    mockPrisma = {
      property: {
        findFirst: jest.fn().mockResolvedValue({
          id: propertyId,
          code: 'PROP01',
          timeZone: 'UTC',
          deletedAt: null,
        }),
      },
      reservation: {
        findFirst: jest.fn().mockResolvedValue({
          id: reservationId,
          propertyId,
          confirmationNumber: 'RES-001',
          status: ReservationStatus.CONFIRMED,
          roomTypeId: 'type-1',
          assignedRoomId: roomId,
          arrivalDate: new Date('2026-09-20T00:00:00.000Z'),
          departureDate: new Date('2026-09-22T00:00:00.000Z'),
          adultsCount: 2,
          childrenCount: 0,
          totalAmount: 300,
          currency: 'USD',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          roomType: { code: 'STD', name: 'Standard Room' },
          assignedRoom: {
            id: roomId,
            propertyId,
            roomNumber: '101',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          guest: {
            id: 'guest-1',
            firstName: 'John',
            lastName: 'Doe',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }),
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockImplementation(() =>
          Promise.resolve({
            id: reservationId,
            propertyId,
            confirmationNumber: 'RES-001',
            status: ReservationStatus.CHECKED_IN,
            roomTypeId: 'type-1',
            assignedRoomId: roomId,
            arrivalDate: new Date('2026-09-20T00:00:00.000Z'),
            departureDate: new Date('2026-09-22T00:00:00.000Z'),
            adultsCount: 2,
            childrenCount: 0,
            totalAmount: 300,
            currency: 'USD',
            version: 2,
            checkInAt: new Date(),
            checkedInBy: actorId,
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
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    mockBusinessDateService = {
      getCurrentBusinessDate: jest.fn().mockReturnValue(new Date('2026-09-20T00:00:00.000Z')),
    };

    mockRoomStatusService = {
      occupyRoom: jest.fn().mockResolvedValue({
        room: {
          id: roomId,
          propertyId,
          roomNumber: '101',
          roomTypeId: 'type-1',
          housekeepingStatus: 'INSPECTED',
          serviceStatus: 'IN_SERVICE',
          occupancyStatus: 'OCCUPIED',
          version: 2,
        },
        effective: {
          isCheckInReady: false,
          serviceStatus: 'IN_SERVICE',
          housekeepingStatus: 'INSPECTED',
          occupancyStatus: 'OCCUPIED',
          isSellable: true,
        },
      }),
      findById: jest.fn().mockResolvedValue({
        roomId,
        propertyId,
        roomNumber: '101',
        roomTypeId: 'type-1',
        housekeepingStatus: 'INSPECTED',
        serviceStatus: 'IN_SERVICE',
        occupancyStatus: 'OCCUPIED',
        version: 2,
        effective: {
          isCheckInReady: false,
          serviceStatus: 'IN_SERVICE',
          housekeepingStatus: 'INSPECTED',
          occupancyStatus: 'OCCUPIED',
          isSellable: true,
        },
      }),
    };

    service = new CheckInService(mockPrisma, mockBusinessDateService, mockRoomStatusService);
  });

  describe('checkIn', () => {
    it('successfully checks in confirmed reservation with assigned inspected room', async () => {
      const res = await service.checkIn(propertyId, reservationId, {}, baseActorContext);

      expect(res.reservation.status).toBe(ReservationStatus.CHECKED_IN);
      expect(mockRoomStatusService.occupyRoom).toHaveBeenCalledWith(
        propertyId,
        roomId,
        expect.objectContaining({ allowCleanOverride: undefined, actorId }),
        expect.anything(),
      );
      expect(mockPrisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ReservationStatus.CHECKED_IN,
            checkedInBy: actorId,
          }),
        }),
      );
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'com.enterprise_hms.pms.reservation.checked_in.v1',
          }),
        }),
      );
    });

    it('rejects check-in if reservation has no assigned room', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-001',
        status: ReservationStatus.CONFIRMED,
        assignedRoomId: null,
        arrivalDate: new Date('2026-09-20T00:00:00.000Z'),
      });

      await expect(
        service.checkIn(propertyId, reservationId, {}, baseActorContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects check-in if reservation arrival date is in the future (prior-date check-in blocked)', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-001',
        status: ReservationStatus.CONFIRMED,
        assignedRoomId: roomId,
        arrivalDate: new Date('2026-09-22T00:00:00.000Z'),
      });

      await expect(
        service.checkIn(propertyId, reservationId, {}, baseActorContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects clean override if actor lacks front_office.checkin.clean_override permission', async () => {
      await expect(
        service.checkIn(propertyId, reservationId, { allowCleanOverride: true }, baseActorContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows clean override when actor possesses supervisor permission', async () => {
      const res = await service.checkIn(
        propertyId,
        reservationId,
        { allowCleanOverride: true, overrideReason: 'VIP priority arrival' },
        supervisorActorContext,
      );

      expect(res.reservation.status).toBe(ReservationStatus.CHECKED_IN);
      expect(mockRoomStatusService.occupyRoom).toHaveBeenCalledWith(
        propertyId,
        roomId,
        expect.objectContaining({ allowCleanOverride: true, reason: 'VIP priority arrival' }),
        expect.anything(),
      );
    });

    it('rejects check-in without idempotency key if reservation is already CHECKED_IN', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-001',
        status: ReservationStatus.CHECKED_IN,
        assignedRoomId: roomId,
        arrivalDate: new Date('2026-09-20T00:00:00.000Z'),
      });

      await expect(
        service.checkIn(propertyId, reservationId, {}, baseActorContext),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('idempotency collision semantics', () => {
    const key = 'test-idemp-key-1';

    it('Case A: same property + same reservation + same key + same payload -> 200 OK idempotent result', async () => {
      // Mock existing reservation with matching key and hash
      const mockExisting = {
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-001',
        status: ReservationStatus.CHECKED_IN,
        assignedRoomId: roomId,
        checkInIdempotencyKey: key,
        checkInPayloadHash: 'c4e433f06b64d17f41f71fbc659c02562fb8f399f7902d2d9ec76ad635bbca54',
        arrivalDate: new Date('2026-09-20T00:00:00.000Z'),
        departureDate: new Date('2026-09-22T00:00:00.000Z'),
        checkInAt: new Date('2026-09-20T10:00:00.000Z'),
        checkedInBy: actorId,
        version: 2,
        totalAmount: 300,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Compute actual hash
      const actualHash = crypto
        .createHash('sha256')
        .update(
          JSON.stringify({
            allowCleanOverride: false,
            overrideReason: null,
            identityVerified: false,
            registrationCardSigned: false,
          }),
        )
        .digest('hex');

      mockExisting.checkInPayloadHash = actualHash;

      mockPrisma.reservation.findUnique.mockResolvedValueOnce(mockExisting);

      const res = await service.checkIn(propertyId, reservationId, {}, baseActorContext, key);

      expect(res.reservation.id).toBe(reservationId);
      expect(res.reservation.status).toBe(ReservationStatus.CHECKED_IN);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('Case B: same property + DIFFERENT reservation + same key -> 409 IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_ENTITY', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValueOnce({
        id: 'different-res-id',
        propertyId,
        confirmationNumber: 'RES-OTHER',
        checkInIdempotencyKey: key,
      });

      await expect(
        service.checkIn(propertyId, reservationId, {}, baseActorContext, key),
      ).rejects.toThrow(ConflictException);
    });

    it('Case C: same reservation + same key + DIFFERENT payload -> 409 IDEMPOTENCY_PAYLOAD_MISMATCH', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-001',
        checkInIdempotencyKey: key,
        checkInPayloadHash: 'hash-of-different-payload',
      });

      await expect(
        service.checkIn(propertyId, reservationId, {}, baseActorContext, key),
      ).rejects.toThrow(ConflictException);
    });
  });
});
