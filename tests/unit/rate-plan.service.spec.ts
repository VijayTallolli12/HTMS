import { BadRequestException } from '@nestjs/common';
import { RatePlanService } from '../../apps/api-core/src/modules/pms/rate-plans/services/rate-plan.service';
import { IRatePlanDeletionValidator } from '../../apps/api-core/src/modules/pms/rate-plans/contracts/rate-plan-deletion-validator.interface';
import { CreateRatePlanDto } from '../../apps/api-core/src/modules/pms/rate-plans/dto/create-rate-plan.dto';

describe('RatePlanService (W1-T04 Rate Plans & Daily Overrides)', () => {
  let service: RatePlanService;
  let mockPrisma: any;
  let mockDeletionValidator: jest.Mocked<IRatePlanDeletionValidator>;

  const propertyId = '01a00000-0000-7000-0000-000000000001';
  const roomTypeId = '01a00000-0000-7000-0000-000000000002';

  beforeEach(() => {
    mockPrisma = {
      property: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: propertyId, currency: 'USD', deletedAt: null }),
      },
      roomType: {
        findFirst: jest.fn().mockResolvedValue({ id: roomTypeId, propertyId, deletedAt: null }),
      },
      ratePlan: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      ratePlanRoomType: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      dailyRate: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    mockDeletionValidator = {
      canDeleteRatePlan: jest.fn().mockResolvedValue({ allowed: true }),
    };

    service = new RatePlanService(mockPrisma, mockDeletionValidator);
  });

  describe('RatePlan Currency & Validation Rules', () => {
    const validDto: CreateRatePlanDto = {
      code: 'BAR',
      name: 'Best Available Rate',
      currency: 'USD',
      validFrom: '2026-10-01',
      validTo: '2026-10-31',
      minStayDays: 1,
      maxStayDays: 14,
      applicableRoomTypes: [
        {
          roomTypeId,
          baseRateAmount: 150,
        },
      ],
    };

    it('should reject currency mismatch against parent property', async () => {
      const invalidCurrencyDto = { ...validDto, currency: 'EUR' };

      await expect(service.create(propertyId, invalidCurrencyDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when validTo is before validFrom', async () => {
      const invalidDatesDto = { ...validDto, validFrom: '2026-10-31', validTo: '2026-10-01' };

      await expect(service.create(propertyId, invalidDatesDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when minStayDays exceeds maxStayDays', async () => {
      const invalidStayDto = { ...validDto, minStayDays: 5, maxStayDays: 2 };

      await expect(service.create(propertyId, invalidStayDto)).rejects.toThrow(BadRequestException);
    });

    it('should create rate plan, map room types, and emit outbox event', async () => {
      const createdPlanEntity = {
        id: 'rp-1',
        propertyId,
        code: 'BAR',
        name: 'Best Available Rate',
        description: null,
        currency: 'USD',
        mealPlanCode: 'RO',
        pricingModel: 'PER_ROOM',
        isClosed: false,
        isClosedToArrival: false,
        isClosedToDeparture: false,
        minStayDays: 1,
        maxStayDays: 14,
        validFrom: new Date('2026-10-01'),
        validTo: new Date('2026-10-31'),
        isActive: true,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        roomTypes: [
          {
            id: 'rprt-1',
            propertyId,
            ratePlanId: 'rp-1',
            roomTypeId,
            baseRateAmount: '150.0000',
            extraAdultRate: '0.0000',
            extraChildRate: '0.0000',
            isActive: true,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockPrisma.ratePlan.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdPlanEntity);

      mockPrisma.ratePlan.create.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          ...data,
          ...createdPlanEntity,
        });
      });

      const result = await service.create(propertyId, validDto);

      expect(result.code).toBe('BAR');
      expect(result.currency).toBe('USD');
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Daily Rate Overrides', () => {
    it('should reject daily override with business date outside rate plan validity window', async () => {
      mockPrisma.ratePlan.findFirst.mockResolvedValue({
        id: 'rp-1',
        propertyId,
        validFrom: new Date('2026-10-01T00:00:00.000Z'),
        validTo: new Date('2026-10-15T00:00:00.000Z'),
        deletedAt: null,
      });

      await expect(
        service.setDailyRateOverride(propertyId, {
          ratePlanId: 'rp-1',
          roomTypeId,
          businessDate: '2026-10-20', // Outside window
          baseRateAmount: 200,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create daily rate override and emit outbox event', async () => {
      mockPrisma.ratePlan.findFirst.mockResolvedValue({
        id: 'rp-1',
        propertyId,
        validFrom: new Date('2026-10-01T00:00:00.000Z'),
        validTo: new Date('2026-10-15T00:00:00.000Z'),
        deletedAt: null,
      });

      mockPrisma.dailyRate.findUnique.mockResolvedValue(null);
      mockPrisma.dailyRate.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...data, createdAt: new Date(), updatedAt: new Date() }),
      );

      const res = await service.setDailyRateOverride(propertyId, {
        ratePlanId: 'rp-1',
        roomTypeId,
        businessDate: '2026-10-05',
        baseRateAmount: 220,
        isClosedToArrival: true,
      });

      expect(res.businessDate).toBe('2026-10-05');
      expect(res.baseRateAmount).toBe('220');
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledTimes(1);
    });
  });
});
