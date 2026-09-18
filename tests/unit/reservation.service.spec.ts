import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReservationService } from '../../apps/api-core/src/modules/pms/reservations/services/reservation.service';
import { ReservationStatus } from '@hms/api-contracts';

describe('ReservationService (W1-T05 Central Reservation Aggregate & Booking Workflow)', () => {
  let service: ReservationService;
  let mockPrisma: any;
  let mockInventoryService: any;
  let mockBusinessDateService: any;

  const propertyId = '01a00000-0000-7000-0000-000000000001';
  const roomTypeId = '01a00000-0000-7000-0000-000000000002';
  const ratePlanId = '01a00000-0000-7000-0000-000000000003';
  const guestId = '01a00000-0000-7000-0000-000000000004';
  const reservationId = '01a00000-0000-7000-0000-000000000005';

  beforeEach(() => {
    mockPrisma = {
      property: {
        findFirst: jest.fn().mockResolvedValue({
          id: propertyId,
          code: 'PROP01',
          name: 'Grand Hotel',
          currency: 'USD',
          timeZone: 'UTC',
          deletedAt: null,
        }),
      },
      roomType: {
        findFirst: jest.fn().mockResolvedValue({
          id: roomTypeId,
          propertyId,
          code: 'DLX',
          name: 'Deluxe Room',
          maxAdults: 2,
          maxChildren: 1,
          maxOccupancy: 3,
          isActive: true,
          deletedAt: null,
        }),
      },
      ratePlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: ratePlanId,
          propertyId,
          code: 'BAR',
          name: 'Best Available Rate',
          currency: 'USD',
          isActive: true,
          deletedAt: null,
        }),
      },
      ratePlanRoomType: {
        findFirst: jest.fn().mockResolvedValue({
          ratePlanId,
          roomTypeId,
          propertyId,
          baseRateAmount: 150,
          isActive: true,
          deletedAt: null,
        }),
      },
      guest: {
        findFirst: jest.fn().mockResolvedValue({
          id: guestId,
          propertyId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+1234567890',
          deletedAt: null,
        }),
        create: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
      },
      reservation: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            ...args.data,
            id: reservationId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUniqueOrThrow: jest.fn(),
      },
      reservationRateNight: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    mockInventoryService = {
      getStayQuote: jest.fn().mockResolvedValue({
        propertyId,
        arrivalDate: '2026-11-10',
        departureDate: '2026-11-12',
        lengthOfStay: 2,
        options: [
          {
            ratePlanId,
            ratePlanCode: 'BAR',
            ratePlanName: 'Best Available Rate',
            roomTypeId,
            roomTypeCode: 'DLX',
            roomTypeName: 'Deluxe Room',
            totalAmount: '300.00',
            currency: 'USD',
            nightlyRates: [
              { date: '2026-11-10', amount: '150.00' },
              { date: '2026-11-11', amount: '150.00' },
            ],
            isAvailable: true,
          },
        ],
      }),
      reserveInventoryRange: jest.fn().mockResolvedValue(undefined),
      releaseInventoryRange: jest.fn().mockResolvedValue(undefined),
    };

    mockBusinessDateService = {
      getCurrentBusinessDate: jest.fn().mockReturnValue(new Date('2026-11-01T00:00:00.000Z')),
      formatBusinessDate: jest.fn().mockImplementation((d: Date) => d.toISOString().slice(0, 10)),
    };

    service = new ReservationService(mockPrisma, mockInventoryService, mockBusinessDateService);
  });

  describe('Reservation Creation Workflow', () => {
    const validDto = {
      roomTypeId,
      ratePlanId,
      arrivalDate: '2026-11-10',
      departureDate: '2026-11-12',
      adultsCount: 2,
      childrenCount: 0,
      guest: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
      },
    };

    it('1. should reject reservation when departureDate <= arrivalDate', async () => {
      await expect(
        service.create(propertyId, {
          ...validDto,
          departureDate: '2026-11-10',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('2. should reject reservation when stay length exceeds 90 nights', async () => {
      await expect(
        service.create(propertyId, {
          ...validDto,
          departureDate: '2027-03-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('3. should reject reservation when occupancy exceeds room type physical capacity', async () => {
      await expect(
        service.create(propertyId, {
          ...validDto,
          adultsCount: 3, // maxAdults is 2
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. should reject reservation when rate plan is not mapped to room type', async () => {
      mockPrisma.ratePlanRoomType.findFirst.mockResolvedValueOnce(null);
      await expect(service.create(propertyId, validDto)).rejects.toThrow(BadRequestException);
    });

    it('5. should reject reservation when stay quote indicates insufficient ATS inventory', async () => {
      mockInventoryService.getStayQuote.mockResolvedValueOnce({
        propertyId,
        arrivalDate: '2026-11-10',
        departureDate: '2026-11-12',
        lengthOfStay: 2,
        options: [
          {
            ratePlanId,
            roomTypeId,
            totalAmount: '0.00',
            currency: 'USD',
            nightlyRates: [],
            isAvailable: false,
            rejectionReason: 'INSUFFICIENT_INVENTORY',
          },
        ],
      });

      await expect(service.create(propertyId, validDto)).rejects.toThrow(ConflictException);
    });

    it('6. should successfully create reservation, book inventory, create guest, snapshots, and outbox event', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-PROP01-ABC123',
        status: ReservationStatus.CONFIRMED,
        guestId,
        guest: {
          id: guestId,
          propertyId,
          firstName: 'Jane',
          lastName: 'Smith',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        roomTypeId,
        roomType: { code: 'DLX', name: 'Deluxe' },
        ratePlanId,
        ratePlan: { code: 'BAR', name: 'Best Available Rate' },
        arrivalDate: new Date('2026-11-10T00:00:00.000Z'),
        departureDate: new Date('2026-11-12T00:00:00.000Z'),
        adultsCount: 2,
        childrenCount: 0,
        totalAmount: 300,
        currency: 'USD',
        version: 0,
        rateNights: [
          {
            id: 'rn-1',
            businessDate: new Date('2026-11-10T00:00:00.000Z'),
            baseRateAmount: 150,
            extraAdultRate: 0,
            extraChildRate: 0,
            totalAmount: 150,
            currency: 'USD',
          },
          {
            id: 'rn-2',
            businessDate: new Date('2026-11-11T00:00:00.000Z'),
            baseRateAmount: 150,
            extraAdultRate: 0,
            extraChildRate: 0,
            totalAmount: 150,
            currency: 'USD',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.create(propertyId, validDto);

      expect(mockInventoryService.reserveInventoryRange).toHaveBeenCalledTimes(1);
      expect(mockPrisma.guest.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.reservation.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.reservationRateNight.createMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(ReservationStatus.CONFIRMED);
      expect(res.nightsCount).toBe(2);
      expect(res.totalAmount).toBe(300);
    });

    it('7. should return existing reservation when idempotencyKey matches', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-PROP01-IDEM01',
        status: ReservationStatus.CONFIRMED,
        guestId,
        roomTypeId,
        ratePlanId,
        arrivalDate: new Date('2026-11-10T00:00:00.000Z'),
        departureDate: new Date('2026-11-12T00:00:00.000Z'),
        adultsCount: 2,
        childrenCount: 0,
        totalAmount: 300,
        currency: 'USD',
        version: 0,
        rateNights: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.create(propertyId, validDto, 'idempotency-uuid-1');

      expect(res.confirmationNumber).toBe('RES-PROP01-IDEM01');
      expect(mockInventoryService.reserveInventoryRange).not.toHaveBeenCalled();
    });
  });

  describe('Reservation Cancellation Workflow', () => {
    it('1. should reject cancellation if reservation does not exist', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.cancel(propertyId, reservationId, { reason: 'Guest cancelled' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('2. should reject cancellation if reservation is already CANCELLED', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        status: ReservationStatus.CANCELLED,
        rateNights: [],
      });

      await expect(
        service.cancel(propertyId, reservationId, { reason: 'Guest cancelled' }),
      ).rejects.toThrow(ConflictException);
    });

    it('3. should successfully cancel confirmed reservation, release inventory, and emit outbox event', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-PROP01-ABC123',
        status: ReservationStatus.CONFIRMED,
        roomTypeId,
        arrivalDate: new Date('2026-11-10T00:00:00.000Z'),
        departureDate: new Date('2026-11-12T00:00:00.000Z'),
        version: 0,
        rateNights: [{ id: 'rn-1' }, { id: 'rn-2' }],
      });

      mockPrisma.reservation.findUniqueOrThrow.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-PROP01-ABC123',
        status: ReservationStatus.CANCELLED,
        cancellationReason: 'Plans changed',
        cancelledAt: new Date(),
        version: 1,
        arrivalDate: new Date('2026-11-10T00:00:00.000Z'),
        departureDate: new Date('2026-11-12T00:00:00.000Z'),
        adultsCount: 2,
        childrenCount: 0,
        totalAmount: 300,
        currency: 'USD',
        rateNights: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.reservation.findFirst.mockResolvedValueOnce({
        id: reservationId,
        propertyId,
        confirmationNumber: 'RES-PROP01-ABC123',
        status: ReservationStatus.CANCELLED,
        cancellationReason: 'Plans changed',
        cancelledAt: new Date(),
        version: 1,
        arrivalDate: new Date('2026-11-10T00:00:00.000Z'),
        departureDate: new Date('2026-11-12T00:00:00.000Z'),
        adultsCount: 2,
        childrenCount: 0,
        totalAmount: 300,
        currency: 'USD',
        rateNights: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.cancel(propertyId, reservationId, { reason: 'Plans changed' });

      expect(mockInventoryService.releaseInventoryRange).toHaveBeenCalledTimes(1);
      expect(mockPrisma.reservation.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(ReservationStatus.CANCELLED);
    });
  });
});
