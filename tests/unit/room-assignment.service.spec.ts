import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { RoomAssignmentService } from '../../apps/api-core/src/modules/pms/front-office/services/room-assignment.service';
import { ReservationStatus, SecurityContext } from '@hms/api-contracts';

describe('RoomAssignmentService (W1-T07 Front Office Room Assignment)', () => {
  let service: RoomAssignmentService;
  let mockPrisma: any;
  let mockBusinessDateService: any;
  let mockReconciliationService: any;

  const propertyId = '01a00000-0000-7000-0000-000000000001';
  const roomTypeId = '01a00000-0000-7000-0000-000000000002';
  const upgradeRoomTypeId = '01a00000-0000-7000-0000-000000000003';
  const reservationId = '01a00000-0000-7000-0000-000000000004';
  const roomId1 = '01a00000-0000-7000-0000-000000000010';
  const roomId2 = '01a00000-0000-7000-0000-000000000020';
  const actorId = '01a00000-0000-7000-0000-000000000099';

  const actorContext: SecurityContext = {
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
    permissions: new Set(['front_office.room_assignment.manage']),
    scopes: Object.freeze([]),
  };

  const upgradeActorContext: SecurityContext = {
    ...actorContext,
    permissions: new Set([
      'front_office.room_assignment.manage',
      'front_office.room_assignment.upgrade',
    ]),
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
          roomTypeId,
          assignedRoomId: null,
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
          guest: {
            id: 'guest-1',
            firstName: 'John',
            lastName: 'Doe',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockImplementation(() =>
          Promise.resolve({
            id: reservationId,
            propertyId,
            confirmationNumber: 'RES-001',
            status: ReservationStatus.CONFIRMED,
            roomTypeId,
            assignedRoomId: roomId1,
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
              id: roomId1,
              propertyId,
              buildingId: 'b-1',
              floorId: 'f-1',
              roomTypeId,
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
        ),
      },
      room: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.id === roomId1) {
            return Promise.resolve({
              id: roomId1,
              propertyId,
              roomNumber: '101',
              roomTypeId,
              isActive: true,
              version: 1,
              deletedAt: null,
            });
          }
          if (where.id === roomId2) {
            return Promise.resolve({
              id: roomId2,
              propertyId,
              roomNumber: '201',
              roomTypeId: upgradeRoomTypeId,
              isActive: true,
              version: 1,
              deletedAt: null,
            });
          }
          return Promise.resolve(null);
        }),
        findUniqueOrThrow: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve({
            id: where.id,
            propertyId,
            roomNumber: where.id === roomId1 ? '101' : '201',
            roomTypeId: where.id === roomId1 ? roomTypeId : upgradeRoomTypeId,
            version: 1,
          }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      roomMaintenanceBlock: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      reservationAssignmentLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    mockBusinessDateService = {
      getCurrentBusinessDate: jest.fn().mockReturnValue(new Date('2026-09-20T00:00:00.000Z')),
    };

    mockReconciliationService = {
      resolveEffectiveState: jest.fn().mockReturnValue({
        isCheckInReady: true,
        serviceStatus: 'IN_SERVICE',
        housekeepingStatus: 'INSPECTED',
        occupancyStatus: 'VACANT',
        isSellable: true,
      }),
    };

    service = new RoomAssignmentService(
      mockPrisma,
      mockBusinessDateService,
      mockReconciliationService,
    );
  });

  describe('assignRoom', () => {
    it('successfully assigns a valid room of matching room type', async () => {
      const res = await service.assignRoom(
        propertyId,
        reservationId,
        { roomId: roomId1 },
        actorContext,
      );

      expect(res.assignedRoomId).toBe(roomId1);
      expect(mockPrisma.room.updateMany).toHaveBeenCalled();
      expect(mockPrisma.reservation.updateMany).toHaveBeenCalled();
      expect(mockPrisma.reservationAssignmentLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ASSIGN',
            newRoomId: roomId1,
          }),
        }),
      );
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalled();
    });

    it('same-room assignment is a strict NO-OP (version unchanged, no log, no event)', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-001',
        status: ReservationStatus.CONFIRMED,
        roomTypeId,
        assignedRoomId: roomId1,
        arrivalDate: new Date('2026-09-20T00:00:00.000Z'),
        departureDate: new Date('2026-09-22T00:00:00.000Z'),
        version: 5,
        assignedAt: new Date('2026-09-18T10:00:00.000Z'),
        assignedBy: 'original-user',
        totalAmount: 300,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        roomType: { code: 'STD', name: 'Standard Room' },
        assignedRoom: {
          id: roomId1,
          propertyId,
          buildingId: 'b-1',
          floorId: 'f-1',
          roomTypeId,
          roomNumber: '101',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const res = await service.assignRoom(
        propertyId,
        reservationId,
        { roomId: roomId1, reason: 'Updated reason', allowUpgrade: true },
        actorContext,
      );

      expect(res.assignedRoomId).toBe(roomId1);
      expect(res.version).toBe(5);
      expect(res.assignedBy).toBe('original-user');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.reservationAssignmentLog.create).not.toHaveBeenCalled();
      expect(mockPrisma.outboxEvent.create).not.toHaveBeenCalled();
    });

    it('rejects room assignment when room type does not match and allowUpgrade is false', async () => {
      await expect(
        service.assignRoom(propertyId, reservationId, { roomId: roomId2 }, actorContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects room type upgrade if actor lacks front_office.room_assignment.upgrade permission', async () => {
      await expect(
        service.assignRoom(
          propertyId,
          reservationId,
          { roomId: roomId2, allowUpgrade: true },
          actorContext,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows room type upgrade when allowUpgrade is true and actor possesses upgrade permission', async () => {
      const res = await service.assignRoom(
        propertyId,
        reservationId,
        { roomId: roomId2, allowUpgrade: true },
        upgradeActorContext,
      );

      expect(res).toBeDefined();
      expect(mockPrisma.room.updateMany).toHaveBeenCalled();
    });

    it('rejects assignment when active maintenance block overlaps stay dates', async () => {
      mockPrisma.roomMaintenanceBlock.findFirst.mockResolvedValueOnce({
        id: 'block-1',
        roomId: roomId1,
        type: 'OUT_OF_ORDER',
        status: 'ACTIVE',
      });

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId: roomId1 }, actorContext),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects assignment when reservation is not in CONFIRMED status', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        status: ReservationStatus.CHECKED_IN,
      });

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId: roomId1 }, actorContext),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('unassignRoom', () => {
    it('successfully unassigns room from confirmed reservation', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-001',
        status: ReservationStatus.CONFIRMED,
        roomTypeId,
        assignedRoomId: roomId1,
        arrivalDate: new Date('2026-09-20T00:00:00.000Z'),
        departureDate: new Date('2026-09-22T00:00:00.000Z'),
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.reservation.findUniqueOrThrow.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-001',
        status: ReservationStatus.CONFIRMED,
        roomTypeId,
        assignedRoomId: null,
        arrivalDate: new Date('2026-09-20T00:00:00.000Z'),
        departureDate: new Date('2026-09-22T00:00:00.000Z'),
        version: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.unassignRoom(
        propertyId,
        reservationId,
        { reason: 'Guest preference' },
        actorContext,
      );

      expect(res.assignedRoomId).toBeNull();
      expect(mockPrisma.reservationAssignmentLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'UNASSIGN',
            previousRoomId: roomId1,
            newRoomId: null,
          }),
        }),
      );
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalled();
    });

    it('is a NO-OP when unassigning a reservation that has no room assigned', async () => {
      const res = await service.unassignRoom(propertyId, reservationId, {}, actorContext);

      expect(res.assignedRoomId).toBeNull();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects unassigning room from a CHECKED_IN reservation', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        status: ReservationStatus.CHECKED_IN,
        assignedRoomId: roomId1,
      });

      await expect(
        service.unassignRoom(propertyId, reservationId, {}, actorContext),
      ).rejects.toThrow(ConflictException);
    });
  });
});
