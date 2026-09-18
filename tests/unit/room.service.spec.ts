import { BadRequestException, ConflictException } from '@nestjs/common';
import { RoomService } from '../../apps/api-core/src/modules/pms/rooms/services/room.service';
import { IRoomDeactivationValidator } from '../../apps/api-core/src/modules/pms/rooms/contracts/room-deactivation-validator.interface';
import { CreateRoomDto } from '../../apps/api-core/src/modules/pms/rooms/dto/create-room.dto';

describe('RoomService (W1-T04 Physical Room Master & Atomic Reassignment)', () => {
  let service: RoomService;
  let mockPrisma: any;
  let mockBusinessDateService: any;
  let mockDeactivationValidator: jest.Mocked<IRoomDeactivationValidator>;

  const propertyId = '01a00000-0000-7000-0000-000000000001';
  const buildingId = '01a00000-0000-7000-0000-000000000002';
  const floorId = '01a00000-0000-7000-0000-000000000003';
  const roomTypeId = '01a00000-0000-7000-0000-000000000004';
  const otherRoomTypeId = '01a00000-0000-7000-0000-000000000005';

  beforeEach(() => {
    mockPrisma = {
      property: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: propertyId, timeZone: 'Asia/Tokyo', deletedAt: null }),
      },
      building: {
        findUnique: jest.fn().mockResolvedValue({ id: buildingId, propertyId, deletedAt: null }),
      },
      floor: {
        findUnique: jest.fn().mockResolvedValue({ id: floorId, buildingId, deletedAt: null }),
      },
      roomType: {
        findFirst: jest.fn().mockResolvedValue({ id: roomTypeId, propertyId, deletedAt: null }),
      },
      room: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      dailyInventory: {
        updateMany: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    mockBusinessDateService = {
      getCurrentBusinessDate: jest.fn().mockReturnValue(new Date('2026-10-01T00:00:00.000Z')),
    };

    mockDeactivationValidator = {
      canDeactivateOrDeleteRoom: jest.fn().mockResolvedValue({ allowed: true }),
    };

    service = new RoomService(mockPrisma, mockBusinessDateService, mockDeactivationValidator);
  });

  describe('Hierarchy Validation on Create', () => {
    const validDto: CreateRoomDto = {
      buildingId,
      floorId,
      roomTypeId,
      roomNumber: '101',
      name: 'Room 101',
    };

    it('should reject building belonging to a different property', async () => {
      mockPrisma.building.findUnique.mockResolvedValue({
        id: buildingId,
        propertyId: 'different-property-id',
        deletedAt: null,
      });

      await expect(service.create(propertyId, validDto)).rejects.toThrow(BadRequestException);
    });

    it('should reject floor belonging to a different building', async () => {
      mockPrisma.floor.findUnique.mockResolvedValue({
        id: floorId,
        buildingId: 'different-building-id',
        deletedAt: null,
      });

      await expect(service.create(propertyId, validDto)).rejects.toThrow(BadRequestException);
    });

    it('should reject room type belonging to a different property', async () => {
      mockPrisma.roomType.findFirst.mockResolvedValue(null);

      await expect(service.create(propertyId, validDto)).rejects.toThrow(BadRequestException);
    });

    it('should successfully create room, increment future inventory, and emit outbox event', async () => {
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...data, createdAt: new Date(), updatedAt: new Date() }),
      );

      const result = await service.create(propertyId, validDto);

      expect(result.roomNumber).toBe('101');
      expect(mockPrisma.dailyInventory.updateMany).toHaveBeenCalledWith({
        where: {
          propertyId,
          roomTypeId,
          businessDate: { gte: expect.any(Date) },
        },
        data: {
          totalRooms: { increment: 1 },
          version: { increment: 1 },
        },
      });

      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Atomic RoomType Reassignment with Lock Ordering', () => {
    it('should sort room type IDs to prevent deadlocks and adjust both inventory pools atomically', async () => {
      const existingRoom = {
        id: 'room-101',
        propertyId,
        buildingId,
        floorId,
        roomTypeId, // old
        roomNumber: '101',
        isActive: true,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.room.findFirst.mockResolvedValue(existingRoom);
      mockPrisma.roomType.findFirst.mockResolvedValue({
        id: otherRoomTypeId,
        propertyId,
        deletedAt: null,
      });
      mockPrisma.room.update.mockResolvedValue({
        ...existingRoom,
        roomTypeId: otherRoomTypeId,
      });

      await service.update(propertyId, 'room-101', {
        roomTypeId: otherRoomTypeId,
      });

      // Verify updateMany was called twice: once for decrement, once for increment
      expect(mockPrisma.dailyInventory.updateMany).toHaveBeenCalledTimes(2);

      // Verify lock order: sorted alphabetically
      const expectedSorted = [roomTypeId, otherRoomTypeId].sort();
      const firstCallTypeId =
        mockPrisma.dailyInventory.updateMany.mock.calls[0][0].where.roomTypeId;
      const secondCallTypeId =
        mockPrisma.dailyInventory.updateMany.mock.calls[1][0].where.roomTypeId;

      expect(firstCallTypeId).toBe(expectedSorted[0]);
      expect(secondCallTypeId).toBe(expectedSorted[1]);

      expect(mockPrisma.room.update).toHaveBeenCalledWith({
        where: { id: 'room-101' },
        data: expect.objectContaining({ roomTypeId: otherRoomTypeId }),
      });
    });

    it('should reject reassignment if deactivation validator disallows it', async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 'room-101',
        propertyId,
        roomTypeId,
        isActive: true,
        deletedAt: null,
      });
      mockPrisma.roomType.findFirst.mockResolvedValue({
        id: otherRoomTypeId,
        propertyId,
        deletedAt: null,
      });
      mockDeactivationValidator.canDeactivateOrDeleteRoom.mockResolvedValue({
        allowed: false,
        reason: 'ACTIVE_OCCUPANCY_EXISTS',
      });

      await expect(
        service.update(propertyId, 'room-101', { roomTypeId: otherRoomTypeId }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
