import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { PropertyBusinessDateService } from '../../apps/api-core/src/modules/pms/common/services/property-business-date.service';
import { SystemClock } from '../../apps/api-core/src/modules/pms/common/services/system-clock.service';
import { AtsCalculatorService } from '../../apps/api-core/src/modules/pms/inventory/services/ats-calculator.service';
import { InventoryService } from '../../apps/api-core/src/modules/pms/inventory/services/inventory.service';
import { ReservationService } from '../../apps/api-core/src/modules/pms/reservations/services/reservation.service';
import { ReservationStatus, PmsEventType } from '@hms/api-contracts';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('W1-T05: Central Reservation Workflow Integration Tests', () => {
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
  let propertyAId: string;
  let propertyBId: string;
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
      data: { id: hotelGroupId, code: `GRP_RES_${testSuffix}`, name: 'Reservation Group' },
    });

    regionId = generateUuidV7();
    await prisma.region.create({
      data: {
        id: regionId,
        hotelGroupId,
        code: `REG_RES_${testSuffix}`,
        name: 'Reservation Region',
      },
    });

    countryId = generateUuidV7();
    await prisma.country.create({
      data: {
        id: countryId,
        regionId,
        code: `CO_${testSuffix}`.slice(0, 10),
        name: 'Reservation Country',
      },
    });

    propertyAId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: propertyAId,
        countryId,
        code: `PRP_RESA_${testSuffix}`,
        name: 'Reservation Property A',
        timeZone: 'UTC',
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    propertyBId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: propertyBId,
        countryId,
        code: `PRP_RESB_${testSuffix}`,
        name: 'Reservation Property B',
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
        propertyId: propertyAId,
        code: `RT_RES_${testSuffix}`,
        name: 'Deluxe King',
        roomClass: 'DELUXE',
        baseOccupancy: 2,
        maxOccupancy: 3,
        maxAdults: 2,
        maxChildren: 1,
        bedConfiguration: [{ type: 'KING', count: 1 }],
      },
    });

    // 3. Rate Plan
    ratePlanId = generateUuidV7();
    await prisma.ratePlan.create({
      data: {
        id: ratePlanId,
        propertyId: propertyAId,
        code: `RP_RES_${testSuffix}`,
        name: 'Standard BAR',
        currency: 'USD',
        minStayDays: 1,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: new Date('2026-12-31T00:00:00.000Z'),
      },
    });

    // 4. Map Rate Plan to Room Type
    await prisma.ratePlanRoomType.create({
      data: {
        id: generateUuidV7(),
        propertyId: propertyAId,
        ratePlanId,
        roomTypeId,
        baseRateAmount: 200,
        extraAdultRate: 50,
        extraChildRate: 25,
        isActive: true,
      },
    });

    // 5. Seed Daily Inventory for Property A (3 rooms for 10 days)
    const baseDate = new Date('2026-11-01T00:00:00.000Z');
    const invData = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date(baseDate.getTime());
      d.setUTCDate(d.getUTCDate() + i);
      invData.push({
        id: generateUuidV7(),
        propertyId: propertyAId,
        roomTypeId,
        businessDate: d,
        totalRooms: 3,
        bookedCount: 0,
        version: 0,
      });
    }
    await prisma.dailyInventory.createMany({ data: invData });
  });

  afterAll(async () => {
    try {
      await prisma.outboxEvent.deleteMany({
        where: { propertyId: { in: [propertyAId, propertyBId] } },
      });
      await prisma.reservationRateNight.deleteMany({ where: { propertyId: propertyAId } });
      await prisma.reservation.deleteMany({
        where: { propertyId: { in: [propertyAId, propertyBId] } },
      });
      await prisma.guest.deleteMany({ where: { propertyId: { in: [propertyAId, propertyBId] } } });
      await prisma.dailyInventory.deleteMany({ where: { propertyId: propertyAId } });
      await prisma.ratePlanRoomType.deleteMany({ where: { propertyId: propertyAId } });
      await prisma.ratePlan.deleteMany({ where: { propertyId: propertyAId } });
      await prisma.roomType.deleteMany({ where: { propertyId: propertyAId } });
      await prisma.property.deleteMany({ where: { id: { in: [propertyAId, propertyBId] } } });
      await prisma.country.deleteMany({ where: { id: countryId } });
      await prisma.region.deleteMany({ where: { id: regionId } });
      await prisma.hotelGroup.deleteMany({ where: { id: hotelGroupId } });
    } finally {
      await prisma.$disconnect();
    }
  });

  let createdReservationId: string;

  it('1. Create Booking: successfully creates reservation, operational guest, nightly rate snapshots, increments bookedCount, and emits outbox event', async () => {
    const arrivalDate = '2026-11-02';
    const departureDate = '2026-11-05'; // 3 nights

    const res = await reservationService.create(propertyAId, {
      roomTypeId,
      ratePlanId,
      arrivalDate,
      departureDate,
      adultsCount: 2,
      childrenCount: 0,
      guest: {
        firstName: 'Alice',
        lastName: 'Walker',
        email: `alice_${testSuffix}@example.com`,
        phone: '+1555123456',
      },
      specialRequests: 'High floor preferred',
    });

    createdReservationId = res.id;

    // Assertions on returned DTO
    expect(res.id).toBeDefined();
    expect(res.confirmationNumber).toMatch(/^RES-PRPRES-[0-9A-HJKMNP-TV-Z]{6}$/);
    expect(res.status).toBe(ReservationStatus.CONFIRMED);
    expect(res.nightsCount).toBe(3);
    expect(res.totalAmount).toBe(600); // 3 nights * $200
    expect(res.currency).toBe('USD');
    expect(res.guest?.firstName).toBe('Alice');
    expect(res.guest?.lastName).toBe('Walker');
    expect(res.rateNights).toHaveLength(3);

    // Verify database DailyInventory: bookedCount should now be 1 for Nov 2, 3, 4
    const invRecords = await prisma.dailyInventory.findMany({
      where: {
        propertyId: propertyAId,
        roomTypeId,
        businessDate: {
          gte: new Date('2026-11-02T00:00:00.000Z'),
          lt: new Date('2026-11-05T00:00:00.000Z'),
        },
      },
    });

    expect(invRecords).toHaveLength(3);
    for (const rec of invRecords) {
      expect(rec.bookedCount).toBe(1);
      expect(rec.version).toBe(1);
    }

    // Verify outbox event written
    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: {
        propertyId: propertyAId,
        subject: res.id,
        type: PmsEventType.RESERVATION_CREATED,
      },
    });

    expect(outboxEvent).toBeDefined();
    expect((outboxEvent?.data as any).confirmationNumber).toBe(res.confirmationNumber);
  });

  it('2. Pricing Snapshot Immutability: altering RatePlan base rate does not change confirmed reservation snapshot', async () => {
    // Alter the base rate on the RatePlanRoomType mapping from 200 to 350
    await prisma.ratePlanRoomType.updateMany({
      where: { propertyId: propertyAId, ratePlanId, roomTypeId },
      data: { baseRateAmount: 350 },
    });

    // Query the reservation
    const res = await reservationService.findById(propertyAId, createdReservationId);

    // Snapshot pricing MUST remain exactly $600 with $200 per night
    expect(res.totalAmount).toBe(600);
    expect(res.rateNights).toHaveLength(3);
    for (const rn of res.rateNights!) {
      expect(rn.baseRateAmount).toBe(200);
      expect(rn.totalAmount).toBe(200);
    }

    // Revert rate mapping for subsequent tests
    await prisma.ratePlanRoomType.updateMany({
      where: { propertyId: propertyAId, ratePlanId, roomTypeId },
      data: { baseRateAmount: 200 },
    });
  });

  it('3. Cancellation Workflow: releases inventory, transitions status to CANCELLED, and emits outbox event', async () => {
    const cancelled = await reservationService.cancel(propertyAId, createdReservationId, {
      reason: 'Travel plans postponed',
    });

    expect(cancelled.status).toBe(ReservationStatus.CANCELLED);
    expect(cancelled.cancellationReason).toBe('Travel plans postponed');
    expect(cancelled.cancelledAt).toBeDefined();

    // Verify inventory bookedCount is restored back to 0
    const invRecords = await prisma.dailyInventory.findMany({
      where: {
        propertyId: propertyAId,
        roomTypeId,
        businessDate: {
          gte: new Date('2026-11-02T00:00:00.000Z'),
          lt: new Date('2026-11-05T00:00:00.000Z'),
        },
      },
    });

    expect(invRecords).toHaveLength(3);
    for (const rec of invRecords) {
      expect(rec.bookedCount).toBe(0);
      expect(rec.version).toBe(2); // 0 -> 1 on create, 1 -> 2 on cancel
    }

    // Verify outbox cancellation event
    const cancelEvent = await prisma.outboxEvent.findFirst({
      where: {
        propertyId: propertyAId,
        subject: createdReservationId,
        type: PmsEventType.RESERVATION_CANCELLED,
      },
    });

    expect(cancelEvent).toBeDefined();
    expect((cancelEvent?.data as any).reason).toBe('Travel plans postponed');

    // Attempting to cancel again must throw 409 Conflict
    await expect(
      reservationService.cancel(propertyAId, createdReservationId, { reason: 'Duplicate attempt' }),
    ).rejects.toThrow(ConflictException);
  });

  it('4. Property Isolation: Property B cannot view or cancel Property A reservation', async () => {
    // Create new reservation on Property A
    const resA = await reservationService.create(propertyAId, {
      roomTypeId,
      ratePlanId,
      arrivalDate: '2026-11-06',
      departureDate: '2026-11-08',
      adultsCount: 1,
      guest: {
        firstName: 'Bob',
        lastName: 'Brown',
      },
    });

    // Property B attempting to find Property A reservation
    await expect(reservationService.findById(propertyBId, resA.id)).rejects.toThrow(
      NotFoundException,
    );

    // Property B attempting to cancel Property A reservation
    await expect(
      reservationService.cancel(propertyBId, resA.id, { reason: 'Unauthorized cancel' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('5. Atomic Failure: error during reservation creation rolls back inventory, guest, and outbox event completely', async () => {
    // Intercept prisma.$transaction to mock failure on tx.reservationRateNight.createMany
    const origTransaction = (prisma.$transaction as any).bind(prisma);
    const txSpy = jest
      .spyOn(prisma, '$transaction')
      .mockImplementation(async (fn: any, opts: any) => {
        if (typeof fn === 'function') {
          return origTransaction(async (tx: any) => {
            tx.reservationRateNight.createMany = jest.fn().mockImplementation(async () => {
              throw new Error('Forced transactional failure during nightly snapshots');
            });
            return fn(tx);
          }, opts);
        }
        return origTransaction(fn, opts);
      });

    const email = `fail_guest_${testSuffix}@example.com`;
    const arrivalDate = '2026-11-08';
    const departureDate = '2026-11-10';

    await expect(
      reservationService.create(propertyAId, {
        roomTypeId,
        ratePlanId,
        arrivalDate,
        departureDate,
        adultsCount: 1,
        guest: {
          firstName: 'Failed',
          lastName: 'Booking',
          email,
        },
      }),
    ).rejects.toThrow('Forced transactional failure during nightly snapshots');

    txSpy.mockRestore();

    // 1. Verify zero ghost inventory (bookedCount must still be 0)
    const invRecords = await prisma.dailyInventory.findMany({
      where: {
        propertyId: propertyAId,
        roomTypeId,
        businessDate: {
          gte: new Date('2026-11-08T00:00:00.000Z'),
          lt: new Date('2026-11-10T00:00:00.000Z'),
        },
      },
    });

    for (const rec of invRecords) {
      expect(rec.bookedCount).toBe(0);
    }

    // 2. Verify zero orphan guest created
    const guest = await prisma.guest.findFirst({
      where: { propertyId: propertyAId, email },
    });
    expect(guest).toBeNull();

    // 3. Verify zero orphan outbox event created
    const outbox = await prisma.outboxEvent.findFirst({
      where: {
        propertyId: propertyAId,
        data: { path: ['guestId'], equals: email },
      },
    });
    expect(outbox).toBeNull();
  });
});
