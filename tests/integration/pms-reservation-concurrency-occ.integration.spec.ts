import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { PropertyBusinessDateService } from '../../apps/api-core/src/modules/pms/common/services/property-business-date.service';
import { SystemClock } from '../../apps/api-core/src/modules/pms/common/services/system-clock.service';
import { AtsCalculatorService } from '../../apps/api-core/src/modules/pms/inventory/services/ats-calculator.service';
import { InventoryService } from '../../apps/api-core/src/modules/pms/inventory/services/inventory.service';
import { ReservationService } from '../../apps/api-core/src/modules/pms/reservations/services/reservation.service';
import { ReservationStatus } from '@hms/api-contracts';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('W1-T05: Reservation Concurrency & OCC Integration Tests', () => {
  jest.setTimeout(60000);

  let prisma: PrismaClient;
  let prismaService: PrismaService;
  let dateService: PropertyBusinessDateService;
  let atsCalculator: AtsCalculatorService;
  let inventoryService: InventoryService;
  let reservationService: ReservationService;

  const testSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  let hotelGroupId: string;
  let regionId: string;
  let countryId: string;
  let propertyId: string;
  let roomTypeId: string;
  let ratePlanId: string;

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();

    prismaService = prisma as unknown as PrismaService;
    const clock = new SystemClock();
    dateService = new PropertyBusinessDateService(clock);
    atsCalculator = new AtsCalculatorService();
    inventoryService = new InventoryService(prismaService, dateService, atsCalculator);
    reservationService = new ReservationService(prismaService, inventoryService, dateService);

    // 1. Organization tree
    hotelGroupId = generateUuidV7();
    await prisma.hotelGroup.create({
      data: { id: hotelGroupId, code: `GRP_OCC_${testSuffix}`, name: 'OCC Group' },
    });

    regionId = generateUuidV7();
    await prisma.region.create({
      data: { id: regionId, hotelGroupId, code: `REG_OCC_${testSuffix}`, name: 'OCC Region' },
    });

    countryId = generateUuidV7();
    await prisma.country.create({
      data: { id: countryId, regionId, code: `CO_${testSuffix}`.slice(0, 10), name: 'OCC Country' },
    });

    propertyId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: propertyId,
        countryId,
        code: `PRP_OCC_${testSuffix}`,
        name: 'OCC Property',
        timeZone: 'UTC',
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    // 2. Room Type
    roomTypeId = generateUuidV7();
    await prisma.roomType.create({
      data: {
        id: roomTypeId,
        propertyId,
        code: `RT_OCC_${testSuffix}`,
        name: 'Single Last Room Type',
        roomClass: 'STANDARD',
        baseOccupancy: 1,
        maxOccupancy: 2,
        maxAdults: 2,
        maxChildren: 0,
        bedConfiguration: [{ type: 'QUEEN', count: 1 }],
      },
    });

    // 3. Rate Plan
    ratePlanId = generateUuidV7();
    await prisma.ratePlan.create({
      data: {
        id: ratePlanId,
        propertyId,
        code: `RP_OCC_${testSuffix}`,
        name: 'OCC BAR',
        currency: 'USD',
        minStayDays: 1,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: new Date('2026-12-31T00:00:00.000Z'),
      },
    });

    // 4. RatePlan mapping
    await prisma.ratePlanRoomType.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        ratePlanId,
        roomTypeId,
        baseRateAmount: 180,
        isActive: true,
      },
    });

    // 5. Seed Daily Inventory with EXACTLY 1 total room across 3 consecutive nights
    const stayNights = [
      new Date('2026-11-20T00:00:00.000Z'),
      new Date('2026-11-21T00:00:00.000Z'),
      new Date('2026-11-22T00:00:00.000Z'),
    ];

    for (const n of stayNights) {
      await prisma.dailyInventory.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          roomTypeId,
          businessDate: n,
          totalRooms: 1, // Only 1 physical room exists
          bookedCount: 0,
          version: 0,
        },
      });
    }
  });

  afterAll(async () => {
    try {
      await prisma.outboxEvent.deleteMany({ where: { propertyId } });
      await prisma.reservationRateNight.deleteMany({ where: { propertyId } });
      await prisma.reservation.deleteMany({ where: { propertyId } });
      await prisma.guest.deleteMany({ where: { propertyId } });
      await prisma.dailyInventory.deleteMany({ where: { propertyId } });
      await prisma.ratePlanRoomType.deleteMany({ where: { propertyId } });
      await prisma.ratePlan.deleteMany({ where: { propertyId } });
      await prisma.roomType.deleteMany({ where: { propertyId } });
      await prisma.property.deleteMany({ where: { id: propertyId } });
      await prisma.country.deleteMany({ where: { id: countryId } });
      await prisma.region.deleteMany({ where: { id: regionId } });
      await prisma.hotelGroup.deleteMany({ where: { id: hotelGroupId } });
    } finally {
      await prisma.$disconnect();
    }
  });

  let winningReservationId: string;

  it('1. Booking Concurrency Race: 10 concurrent requests for last available room across 3 nights: exactly 1 succeeds, 9 receive 409 Conflict', async () => {
    const arrivalDate = '2026-11-20';
    const departureDate = '2026-11-23'; // 3 nights

    // Fire 10 concurrent booking requests
    const attempts = Array.from({ length: 10 }, (_, i) =>
      reservationService.create(propertyId, {
        roomTypeId,
        ratePlanId,
        arrivalDate,
        departureDate,
        adultsCount: 1,
        guest: {
          firstName: `Competitor_${i}`,
          lastName: `Guest_${testSuffix}`,
          email: `competitor_${i}_${testSuffix}@example.com`,
        },
      }),
    );

    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(9);

    // Verify all 9 rejected requests threw ConflictException (409)
    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        expect(rej.reason).toBeInstanceOf(ConflictException);
      }
    }

    winningReservationId = (fulfilled[0] as PromiseFulfilledResult<any>).value.id;
    expect(winningReservationId).toBeDefined();

    // Verify database DailyInventory: bookedCount must be exactly 1, version must be 1 for all 3 nights
    const invRecords = await prisma.dailyInventory.findMany({
      where: {
        propertyId,
        roomTypeId,
        businessDate: {
          gte: new Date('2026-11-20T00:00:00.000Z'),
          lt: new Date('2026-11-23T00:00:00.000Z'),
        },
      },
    });

    expect(invRecords).toHaveLength(3);
    for (const rec of invRecords) {
      expect(rec.bookedCount).toBe(1);
      expect(rec.version).toBe(1);
    }
  });

  it('2. Cancellation Concurrency Race: 2 concurrent cancellation attempts for the same reservation: exactly 1 succeeds, 1 receives 409 Conflict', async () => {
    // Fire 2 concurrent cancellations on the winning reservation
    const cancelAttempts = [
      reservationService.cancel(propertyId, winningReservationId, { reason: 'Cancellation A' }),
      reservationService.cancel(propertyId, winningReservationId, { reason: 'Cancellation B' }),
    ];

    const results = await Promise.allSettled(cancelAttempts);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);

    // Verify inventory bookedCount is restored back to 0 (released exactly once)
    const invRecords = await prisma.dailyInventory.findMany({
      where: {
        propertyId,
        roomTypeId,
        businessDate: {
          gte: new Date('2026-11-20T00:00:00.000Z'),
          lt: new Date('2026-11-23T00:00:00.000Z'),
        },
      },
    });

    expect(invRecords).toHaveLength(3);
    for (const rec of invRecords) {
      expect(rec.bookedCount).toBe(0);
      expect(rec.version).toBe(2);
    }

    // Verify reservation status in DB is CANCELLED
    const res = await prisma.reservation.findUnique({
      where: { id: winningReservationId },
    });
    expect(res?.status).toBe(ReservationStatus.CANCELLED);
    expect(res?.version).toBe(1);
  });
});
