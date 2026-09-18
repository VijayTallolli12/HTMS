import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
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

describe('W1-T05: Reservation Idempotency Integration Tests', () => {
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
      data: { id: hotelGroupId, code: `GRP_IDM_${testSuffix}`, name: 'Idempotency Group' },
    });

    regionId = generateUuidV7();
    await prisma.region.create({
      data: {
        id: regionId,
        hotelGroupId,
        code: `REG_IDM_${testSuffix}`,
        name: 'Idempotency Region',
      },
    });

    countryId = generateUuidV7();
    await prisma.country.create({
      data: {
        id: countryId,
        regionId,
        code: `CO_${testSuffix}`.slice(0, 10),
        name: 'Idempotency Country',
      },
    });

    propertyId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: propertyId,
        countryId,
        code: `PRP_IDM_${testSuffix}`,
        name: 'Idempotency Property',
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
        code: `RT_IDM_${testSuffix}`,
        name: 'Idempotency Room',
        roomClass: 'STANDARD',
        baseOccupancy: 2,
        maxOccupancy: 2,
        maxAdults: 2,
        maxChildren: 0,
        bedConfiguration: [{ type: 'KING', count: 1 }],
      },
    });

    // 3. Rate Plan
    ratePlanId = generateUuidV7();
    await prisma.ratePlan.create({
      data: {
        id: ratePlanId,
        propertyId,
        code: `RP_IDM_${testSuffix}`,
        name: 'Idempotency BAR',
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
        baseRateAmount: 150,
        isActive: true,
      },
    });

    // 5. Seed Daily Inventory (10 rooms for 10 days)
    const baseDate = new Date('2026-12-01T00:00:00.000Z');
    const invData = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date(baseDate.getTime());
      d.setUTCDate(d.getUTCDate() + i);
      invData.push({
        id: generateUuidV7(),
        propertyId,
        roomTypeId,
        businessDate: d,
        totalRooms: 10,
        bookedCount: 0,
        version: 0,
      });
    }
    await prisma.dailyInventory.createMany({ data: invData });
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

  it('1. Sequential Idempotency: repeated calls with identical Idempotency-Key return original reservation without double-booking', async () => {
    const idempotencyKey = `idem_seq_${testSuffix}`;

    // First request
    const res1 = await reservationService.create(
      propertyId,
      {
        roomTypeId,
        ratePlanId,
        arrivalDate: '2026-12-02',
        departureDate: '2026-12-04', // 2 nights
        adultsCount: 2,
        guest: {
          firstName: 'John',
          lastName: 'Idempotent',
        },
      },
      idempotencyKey,
    );

    expect(res1.id).toBeDefined();
    expect(res1.status).toBe(ReservationStatus.CONFIRMED);

    // Second request with SAME idempotency key
    const res2 = await reservationService.create(
      propertyId,
      {
        roomTypeId,
        ratePlanId,
        arrivalDate: '2026-12-02',
        departureDate: '2026-12-04',
        adultsCount: 2,
        guest: {
          firstName: 'John',
          lastName: 'Idempotent',
        },
      },
      idempotencyKey,
    );

    // Must return the exact same reservation
    expect(res2.id).toBe(res1.id);
    expect(res2.confirmationNumber).toBe(res1.confirmationNumber);

    // Verify database inventory bookedCount was only incremented ONCE (bookedCount === 1, not 2)
    const invRecords = await prisma.dailyInventory.findMany({
      where: {
        propertyId,
        roomTypeId,
        businessDate: {
          gte: new Date('2026-12-02T00:00:00.000Z'),
          lt: new Date('2026-12-04T00:00:00.000Z'),
        },
      },
    });

    expect(invRecords).toHaveLength(2);
    for (const rec of invRecords) {
      expect(rec.bookedCount).toBe(1);
    }

    // Verify database contains exactly ONE reservation with this idempotency key
    const count = await prisma.reservation.count({
      where: { propertyId, idempotencyKey },
    });
    expect(count).toBe(1);
  });

  it('2. Concurrent Idempotency: multiple concurrent requests with identical Idempotency-Key return the same reservation and book inventory once', async () => {
    const idempotencyKey = `idem_conc_${testSuffix}`;

    const attempts = Array.from({ length: 5 }, () =>
      reservationService.create(
        propertyId,
        {
          roomTypeId,
          ratePlanId,
          arrivalDate: '2026-12-05',
          departureDate: '2026-12-07', // 2 nights
          adultsCount: 2,
          guest: {
            firstName: 'Concurrent',
            lastName: 'Booker',
          },
        },
        idempotencyKey,
      ),
    );

    const results = await Promise.all(attempts);

    // All 5 requests must resolve successfully
    expect(results).toHaveLength(5);

    // All 5 requests must return the exact same reservation ID
    const firstId = results[0].id;
    for (const r of results) {
      expect(r.id).toBe(firstId);
      expect(r.confirmationNumber).toBe(results[0].confirmationNumber);
    }

    // Verify inventory bookedCount incremented by exactly 1
    const invRecords = await prisma.dailyInventory.findMany({
      where: {
        propertyId,
        roomTypeId,
        businessDate: {
          gte: new Date('2026-12-05T00:00:00.000Z'),
          lt: new Date('2026-12-07T00:00:00.000Z'),
        },
      },
    });

    expect(invRecords).toHaveLength(2);
    for (const rec of invRecords) {
      expect(rec.bookedCount).toBe(1);
    }
  });

  it('3. Multiple NULL keys: omitting Idempotency-Key allows multiple distinct reservations without collision', async () => {
    const resA = await reservationService.create(propertyId, {
      roomTypeId,
      ratePlanId,
      arrivalDate: '2026-12-08',
      departureDate: '2026-12-09',
      adultsCount: 1,
      guest: { firstName: 'NoKey', lastName: 'One' },
    });

    const resB = await reservationService.create(propertyId, {
      roomTypeId,
      ratePlanId,
      arrivalDate: '2026-12-08',
      departureDate: '2026-12-09',
      adultsCount: 1,
      guest: { firstName: 'NoKey', lastName: 'Two' },
    });

    expect(resA.id).not.toBe(resB.id);
    expect(resA.confirmationNumber).not.toBe(resB.confirmationNumber);

    // Verify inventory bookedCount is 2
    const inv = await prisma.dailyInventory.findFirst({
      where: {
        propertyId,
        roomTypeId,
        businessDate: new Date('2026-12-08T00:00:00.000Z'),
      },
    });

    expect(inv?.bookedCount).toBe(2);
  });
});
