import { BadRequestException, ConflictException } from '@nestjs/common';
import { RoomStatusService } from '../../apps/api-core/src/modules/pms/room-operations/services/room-status.service';
import { RoomStatusReconciliationService } from '../../apps/api-core/src/modules/pms/room-operations/services/room-status-reconciliation.service';
import { HousekeepingStatus, RoomOccupancyStatus, RoomServiceStatus } from '@hms/api-contracts';

describe('RoomStatusService (W1-T06 Room Operations Status State Machine)', () => {
  let service: RoomStatusService;
  let reconciliationService: RoomStatusReconciliationService;
  let mockPrisma: any;
  let mockBusinessDateService: any;

  const propertyId = '01a00000-0000-7000-0000-000000000001';
  const roomId = '01a00000-0000-7000-0000-000000000002';
  const userId = '01a00000-0000-7000-0000-000000000099';

  beforeEach(() => {
    mockPrisma = {
      property: {
        findUnique: jest.fn().mockResolvedValue({
          id: propertyId,
          code: 'PROP01',
          name: 'Grand Hotel',
          timeZone: 'UTC',
          deletedAt: null,
        }),
      },
      room: {
        findFirst: jest.fn().mockResolvedValue({
          id: roomId,
          propertyId,
          roomNumber: '101',
          roomTypeId: '01a00000-0000-7000-0000-000000000010',
          housekeepingStatus: HousekeepingStatus.DIRTY,
          serviceStatus: RoomServiceStatus.IN_SERVICE,
          occupancyStatus: RoomOccupancyStatus.VACANT,
          version: 1,
          deletedAt: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockImplementation(() =>
          Promise.resolve({
            id: roomId,
            propertyId,
            roomNumber: '101',
            roomTypeId: '01a00000-0000-7000-0000-000000000010',
            housekeepingStatus: HousekeepingStatus.CLEANING,
            serviceStatus: RoomServiceStatus.IN_SERVICE,
            occupancyStatus: RoomOccupancyStatus.VACANT,
            version: 2,
            deletedAt: null,
          }),
        ),
      },
      roomMaintenanceBlock: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      roomStatusLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(mockPrisma)),
    };

    mockBusinessDateService = {
      getCurrentBusinessDate: jest.fn().mockReturnValue(new Date('2026-09-18T00:00:00.000Z')),
    };

    reconciliationService = new RoomStatusReconciliationService(mockPrisma);
    service = new RoomStatusService(mockPrisma, mockBusinessDateService, reconciliationService);
  });

  describe('Housekeeping State Machine Valid Transitions', () => {
    it('allows transition from DIRTY to CLEANING', async () => {
      const result = await service.updateHousekeepingStatus(
        propertyId,
        roomId,
        { housekeepingStatus: HousekeepingStatus.CLEANING },
        userId,
      );

      expect(mockPrisma.room.updateMany).toHaveBeenCalledWith({
        where: { id: roomId, propertyId, version: 1 },
        data: { housekeepingStatus: HousekeepingStatus.CLEANING, version: { increment: 1 } },
      });
      expect(mockPrisma.roomStatusLog.create).toHaveBeenCalled();
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalled();
      expect(result.roomId).toBe(roomId);
    });

    it('allows transition from CLEANING to CLEAN', async () => {
      mockPrisma.room.findFirst.mockResolvedValueOnce({
        id: roomId,
        propertyId,
        roomNumber: '101',
        housekeepingStatus: HousekeepingStatus.CLEANING,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        version: 2,
      });
      mockPrisma.room.findUniqueOrThrow.mockResolvedValueOnce({
        id: roomId,
        propertyId,
        roomNumber: '101',
        housekeepingStatus: HousekeepingStatus.CLEAN,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        version: 3,
      });

      const result = await service.updateHousekeepingStatus(
        propertyId,
        roomId,
        { housekeepingStatus: HousekeepingStatus.CLEAN },
        userId,
      );

      expect(result.housekeepingStatus).toBe(HousekeepingStatus.CLEAN);
    });

    it('allows transition from CLEAN to INSPECTED', async () => {
      mockPrisma.room.findFirst.mockResolvedValueOnce({
        id: roomId,
        propertyId,
        roomNumber: '101',
        housekeepingStatus: HousekeepingStatus.CLEAN,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        version: 3,
      });
      mockPrisma.room.findUniqueOrThrow.mockResolvedValueOnce({
        id: roomId,
        propertyId,
        roomNumber: '101',
        housekeepingStatus: HousekeepingStatus.INSPECTED,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        version: 4,
      });

      const result = await service.updateHousekeepingStatus(
        propertyId,
        roomId,
        { housekeepingStatus: HousekeepingStatus.INSPECTED },
        userId,
      );

      expect(result.housekeepingStatus).toBe(HousekeepingStatus.INSPECTED);
      expect(result.effective.isCheckInReady).toBe(true);
    });

    it('allows transition from INSPECTED to PICKUP', async () => {
      mockPrisma.room.findFirst.mockResolvedValueOnce({
        id: roomId,
        propertyId,
        roomNumber: '101',
        housekeepingStatus: HousekeepingStatus.INSPECTED,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        version: 4,
      });
      mockPrisma.room.findUniqueOrThrow.mockResolvedValueOnce({
        id: roomId,
        propertyId,
        roomNumber: '101',
        housekeepingStatus: HousekeepingStatus.PICKUP,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        version: 5,
      });

      const result = await service.updateHousekeepingStatus(
        propertyId,
        roomId,
        { housekeepingStatus: HousekeepingStatus.PICKUP },
        userId,
      );

      expect(result.housekeepingStatus).toBe(HousekeepingStatus.PICKUP);
    });
  });

  describe('Housekeeping State Machine Forbidden Transitions', () => {
    it('rejects DIRTY -> INSPECTED with BadRequestException', async () => {
      await expect(
        service.updateHousekeepingStatus(
          propertyId,
          roomId,
          { housekeepingStatus: HousekeepingStatus.INSPECTED },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.room.updateMany).not.toHaveBeenCalled();
    });

    it('rejects DIRTY -> PICKUP with BadRequestException', async () => {
      await expect(
        service.updateHousekeepingStatus(
          propertyId,
          roomId,
          { housekeepingStatus: HousekeepingStatus.PICKUP },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects INSPECTED -> CLEANING with BadRequestException', async () => {
      mockPrisma.room.findFirst.mockResolvedValueOnce({
        id: roomId,
        propertyId,
        roomNumber: '101',
        housekeepingStatus: HousekeepingStatus.INSPECTED,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        version: 4,
      });

      await expect(
        service.updateHousekeepingStatus(
          propertyId,
          roomId,
          { housekeepingStatus: HousekeepingStatus.CLEANING },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Housekeeping Idempotency & OCC', () => {
    it('is idempotent when target status matches current status (no-op)', async () => {
      const result = await service.updateHousekeepingStatus(
        propertyId,
        roomId,
        { housekeepingStatus: HousekeepingStatus.DIRTY },
        userId,
      );

      expect(mockPrisma.room.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.roomStatusLog.create).not.toHaveBeenCalled();
      expect(result.housekeepingStatus).toBe(HousekeepingStatus.DIRTY);
    });

    it('throws ConflictException on OCC collision', async () => {
      mockPrisma.room.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.updateHousekeepingStatus(
          propertyId,
          roomId,
          { housekeepingStatus: HousekeepingStatus.CLEANING },
          userId,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Pure Evaluation: RoomStatusReconciliationService.resolveEffectiveState', () => {
    const today = new Date('2026-09-18T00:00:00.000Z');

    it('resolves active OUT_OF_ORDER block as non-sellable and not check-in ready', () => {
      const room: any = {
        id: roomId,
        housekeepingStatus: HousekeepingStatus.INSPECTED,
        occupancyStatus: RoomOccupancyStatus.VACANT,
      };
      const activeBlock: any = {
        id: 'block-1',
        type: 'OUT_OF_ORDER',
      };

      const effective = reconciliationService.resolveEffectiveState(
        room,
        activeBlock,
        today,
        false,
      );

      expect(effective.serviceStatus).toBe(RoomServiceStatus.OUT_OF_ORDER);
      expect(effective.isSellable).toBe(false);
      expect(effective.isCheckInReady).toBe(false);
      expect(effective.activeMaintenanceBlockId).toBe('block-1');
    });

    it('resolves active OUT_OF_SERVICE block with includeOOS=false as sellable but not check-in ready', () => {
      const room: any = {
        id: roomId,
        housekeepingStatus: HousekeepingStatus.INSPECTED,
        occupancyStatus: RoomOccupancyStatus.VACANT,
      };
      const activeBlock: any = {
        id: 'block-2',
        type: 'OUT_OF_SERVICE',
      };

      const effective = reconciliationService.resolveEffectiveState(
        room,
        activeBlock,
        today,
        false,
      );

      expect(effective.serviceStatus).toBe(RoomServiceStatus.OUT_OF_SERVICE);
      expect(effective.isSellable).toBe(true);
      expect(effective.isCheckInReady).toBe(false);
    });

    it('resolves active OUT_OF_SERVICE block with includeOOS=true as non-sellable', () => {
      const room: any = {
        id: roomId,
        housekeepingStatus: HousekeepingStatus.INSPECTED,
        occupancyStatus: RoomOccupancyStatus.VACANT,
      };
      const activeBlock: any = {
        id: 'block-2',
        type: 'OUT_OF_SERVICE',
      };

      const effective = reconciliationService.resolveEffectiveState(room, activeBlock, today, true);

      expect(effective.serviceStatus).toBe(RoomServiceStatus.OUT_OF_SERVICE);
      expect(effective.isSellable).toBe(false);
    });

    it('resolves IN_SERVICE, INSPECTED, and VACANT as check-in ready', () => {
      const room: any = {
        id: roomId,
        housekeepingStatus: HousekeepingStatus.INSPECTED,
        occupancyStatus: RoomOccupancyStatus.VACANT,
      };

      const effective = reconciliationService.resolveEffectiveState(room, null, today, false);

      expect(effective.serviceStatus).toBe(RoomServiceStatus.IN_SERVICE);
      expect(effective.isSellable).toBe(true);
      expect(effective.isCheckInReady).toBe(true);
    });

    it('resolves IN_SERVICE, CLEAN, and VACANT as sellable but NOT check-in ready', () => {
      const room: any = {
        id: roomId,
        housekeepingStatus: HousekeepingStatus.CLEAN,
        occupancyStatus: RoomOccupancyStatus.VACANT,
      };

      const effective = reconciliationService.resolveEffectiveState(room, null, today, false);

      expect(effective.serviceStatus).toBe(RoomServiceStatus.IN_SERVICE);
      expect(effective.isSellable).toBe(true);
      expect(effective.isCheckInReady).toBe(false);
    });
  });
});
