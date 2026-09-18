import { ConflictException, NotFoundException } from '@nestjs/common';
import { RoomTypeService } from '../../apps/api-core/src/modules/pms/room-types/services/room-type.service';
import { DefaultRoomTypeDeletionValidator } from '../../apps/api-core/src/modules/pms/room-types/services/default-room-type-deletion-validator.service';
import { IRoomTypeDeletionValidator } from '../../apps/api-core/src/modules/pms/room-types/contracts/room-type-deletion-validator.interface';
import { CreateRoomTypeDto } from '../../apps/api-core/src/modules/pms/room-types/dto/create-room-type.dto';
import { PmsEventType } from '@hms/api-contracts';

describe('RoomTypeService & DefaultRoomTypeDeletionValidator (W1-T04)', () => {
  let service: RoomTypeService;
  let validator: DefaultRoomTypeDeletionValidator;
  let mockPrisma: any;
  let mockBusinessDateService: any;
  let mockDeletionValidator: jest.Mocked<IRoomTypeDeletionValidator>;

  const mockProperty = {
    id: '01a00000-0000-7000-0000-000000000001',
    timeZone: 'Asia/Tokyo',
    currency: 'JPY',
    deletedAt: null,
  };

  beforeEach(() => {
    mockPrisma = {
      property: {
        findUnique: jest.fn().mockResolvedValue(mockProperty),
      },
      roomType: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      room: {
        count: jest.fn(),
      },
      dailyInventory: {
        createMany: jest.fn(),
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
      addDays: jest.fn().mockImplementation((d: Date, days: number) => {
        const res = new Date(d.getTime());
        res.setUTCDate(res.getUTCDate() + days);
        return res;
      }),
    };

    mockDeletionValidator = {
      canDeleteRoomType: jest.fn().mockResolvedValue({ allowed: true }),
    };

    validator = new DefaultRoomTypeDeletionValidator(mockPrisma);
    service = new RoomTypeService(mockPrisma, mockBusinessDateService, mockDeletionValidator);
  });

  describe('DefaultRoomTypeDeletionValidator (Decoupled Extension Point)', () => {
    it('should permit deletion when 0 physical rooms exist for the room type', async () => {
      mockPrisma.room.count.mockResolvedValue(0);

      const res = await validator.canDeleteRoomType(mockProperty.id, 'rt-1');
      expect(res.allowed).toBe(true);
      expect(mockPrisma.room.count).toHaveBeenCalledWith({
        where: { propertyId: mockProperty.id, roomTypeId: 'rt-1', deletedAt: null },
      });
    });

    it('should block deletion when physical rooms exist without any T05 reservation coupling', async () => {
      mockPrisma.room.count.mockResolvedValue(3);

      const res = await validator.canDeleteRoomType(mockProperty.id, 'rt-1');
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('ACTIVE_ROOMS_EXIST');
    });
  });

  describe('RoomTypeService.create', () => {
    const validDto: CreateRoomTypeDto = {
      code: 'DLX-K',
      name: 'Deluxe King',
      roomClass: 'DELUXE',
      baseOccupancy: 2,
      maxOccupancy: 3,
      maxAdults: 2,
      maxChildren: 1,
      bedConfiguration: [{ type: 'KING', count: 1 }],
      amenities: ['WIFI'],
    };

    it('should create room type, initialize 365 daily inventory records, and emit outbox event', async () => {
      mockPrisma.roomType.findFirst.mockResolvedValue(null);
      mockPrisma.roomType.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...data, createdAt: new Date(), updatedAt: new Date() }),
      );

      const result = await service.create(mockProperty.id, validDto);

      expect(result.code).toBe('DLX-K');
      expect(result.name).toBe('Deluxe King');
      expect(mockPrisma.dailyInventory.createMany).toHaveBeenCalledTimes(1);

      const invArg = mockPrisma.dailyInventory.createMany.mock.calls[0][0];
      expect(invArg.data).toHaveLength(365);
      expect(invArg.data[0].businessDate.toISOString()).toBe('2026-10-01T00:00:00.000Z');
      expect(invArg.data[0].totalRooms).toBe(0);

      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledTimes(1);
      const eventArg = mockPrisma.outboxEvent.create.mock.calls[0][0];
      expect(eventArg.data.type).toBe(PmsEventType.ROOM_TYPE_CREATED);
    });

    it('should throw ConflictException if room type code already exists for property', async () => {
      mockPrisma.roomType.findFirst.mockResolvedValue({ id: 'existing-id', code: 'DLX-K' });

      await expect(service.create(mockProperty.id, validDto)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if property does not exist', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(null);

      await expect(service.create('non-existent-prop', validDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('RoomTypeService.delete', () => {
    it('should block deletion if validator rejects', async () => {
      mockPrisma.roomType.findFirst.mockResolvedValue({
        id: 'rt-1',
        propertyId: mockProperty.id,
        name: 'Deluxe King',
        code: 'DLX-K',
        deletedAt: null,
      });
      mockDeletionValidator.canDeleteRoomType.mockResolvedValue({
        allowed: false,
        reason: 'ACTIVE_ROOMS_EXIST',
      });

      await expect(service.delete(mockProperty.id, 'rt-1')).rejects.toThrow(ConflictException);
    });

    it('should soft-delete room type and emit outbox event when validator allows', async () => {
      const existing = {
        id: 'rt-1',
        propertyId: mockProperty.id,
        name: 'Deluxe King',
        code: 'DLX-K',
        deletedAt: null,
        isActive: true,
        bedConfiguration: [],
        amenities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.roomType.findFirst.mockResolvedValue(existing);
      mockPrisma.roomType.update.mockResolvedValue({
        ...existing,
        isActive: false,
        deletedAt: new Date(),
      });

      const res = await service.delete(mockProperty.id, 'rt-1');

      expect(res.isActive).toBe(false);
      expect(mockPrisma.roomType.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
      });
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledTimes(1);
    });
  });
});
