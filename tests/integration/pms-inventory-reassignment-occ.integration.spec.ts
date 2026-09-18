import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { PropertyBusinessDateService } from '../../apps/api-core/src/modules/pms/common/services/property-business-date.service';
import { SystemClock } from '../../apps/api-core/src/modules/pms/common/services/system-clock.service';
import { AtsCalculatorService } from '../../apps/api-core/src/modules/pms/inventory/services/ats-calculator.service';
import { InventoryService } from '../../apps/api-core/src/modules/pms/inventory/services/inventory.service';
import { RoomService } from '../../apps/api-core/src/modules/pms/rooms/services/room.service';
import { DefaultRoomDeactivationValidator } from '../../apps/api-core/src/modules/pms/rooms/services/default-room-deactivation-validator.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('W1-T04: Atomic RoomType Reassignment & OCC Concurrency Integration Tests', () => {
  jest.setTimeout(60000);

  let prisma: PrismaClient;
  let prismaService: PrismaService;
  let dateService: PropertyBusinessDateService;
  let atsCalculator: AtsCalculatorService;
  let inventoryService: InventoryService;
  let roomService: RoomService;

  const testSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  let hotelGroupId: string;
  let regionId: string;
  let countryId: string;
  let propertyId: string;
  let buildingId: string;
  let floorId: string;
  let roomTypeAId: string;
  let roomTypeBId: string;
  let roomTypeCId: string;
  let roomId: string;

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();

    prismaService = prisma as unknown as PrismaService;
    const clock = new SystemClock();
    dateService = new PropertyBusinessDateService(clock);
    atsCalculator = new AtsCalculatorService();
    inventoryService = new InventoryService(prismaService, dateService, atsCalculator);
    const deactivationValidator = new DefaultRoomDeactivationValidator();
    roomService = new RoomService(prismaService, dateService, deactivationValidator);

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

    buildingId = generateUuidV7();
    await prisma.building.create({
      data: { id: buildingId, propertyId, code: `BLD_OCC_${testSuffix}`, name: 'OCC Building' },
    });

    floorId = generateUuidV7();
    await prisma.floor.create({
      data: {
        id: floorId,
        buildingId,
        code: `FL_OCC_${testSuffix}`,
        floorNumber: 1,
        name: 'Floor 1',
      },
    });

    // 2. Room Types A (Deluxe) and B (Suite)
    roomTypeAId = generateUuidV7();
    await prisma.roomType.create({
      data: {
        id: roomTypeAId,
        propertyId,
        code: `RTA_OCC_${testSuffix}`,
        name: 'Deluxe Room',
        roomClass: 'DELUXE',
        bedConfiguration: [{ type: 'KING', count: 1 }],
      },
    });

    roomTypeBId = generateUuidV7();
    await prisma.roomType.create({
      data: {
        id: roomTypeBId,
        propertyId,
        code: `RTB_OCC_${testSuffix}`,
        name: 'Suite Room',
        roomClass: 'SUITE',
        bedConfiguration: [{ type: 'KING', count: 2 }],
      },
    });

    // Seed 10 days of daily inventory for Type A and Type B
    const today = dateService.getCurrentBusinessDate('UTC');
    const invTypeA = [];
    const invTypeB = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date(today.getTime());
      d.setUTCDate(d.getUTCDate() + i);
      invTypeA.push({
        id: generateUuidV7(),
        propertyId,
        roomTypeId: roomTypeAId,
        businessDate: d,
        totalRooms: 1, // Currently 1 Deluxe room
        version: 0,
      });
      invTypeB.push({
        id: generateUuidV7(),
        propertyId,
        roomTypeId: roomTypeBId,
        businessDate: d,
        totalRooms: 0, // Currently 0 Suite rooms
        version: 0,
      });
    }
    await prisma.dailyInventory.createMany({ data: [...invTypeA, ...invTypeB] });

    // Create Room 101 under Type A
    roomId = generateUuidV7();
    await prisma.room.create({
      data: {
        id: roomId,
        propertyId,
        buildingId,
        floorId,
        roomTypeId: roomTypeAId,
        roomNumber: `RM_101_${testSuffix}`,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    try {
      await prisma.outboxEvent.deleteMany({ where: { propertyId } });
      await prisma.dailyInventory.deleteMany({ where: { propertyId } });
      await prisma.room.deleteMany({ where: { id: roomId } });
      await prisma.roomType.deleteMany({
        where: { id: { in: [roomTypeAId, roomTypeBId, roomTypeCId].filter(Boolean) as string[] } },
      });
      await prisma.floor.deleteMany({ where: { id: floorId } });
      await prisma.building.deleteMany({ where: { id: buildingId } });
      await prisma.property.deleteMany({ where: { id: propertyId } });
      await prisma.country.deleteMany({ where: { id: countryId } });
      await prisma.region.deleteMany({ where: { id: regionId } });
      await prisma.hotelGroup.deleteMany({ where: { id: hotelGroupId } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('1. Atomic RoomType Reassignment: reassigns Room 101 from Deluxe to Suite and updates both inventories atomically', async () => {
    // Reassign Room 101 from RoomType A to RoomType B
    const updated = await roomService.update(propertyId, roomId, {
      roomTypeId: roomTypeBId,
    });

    expect(updated.roomTypeId).toBe(roomTypeBId);

    // Verify Type A inventory decremented to 0
    const typeARecords = await prisma.dailyInventory.findMany({
      where: { propertyId, roomTypeId: roomTypeAId },
    });
    for (const rec of typeARecords) {
      expect(rec.totalRooms).toBe(0);
      expect(rec.version).toBe(1);
    }

    // Verify Type B inventory incremented to 1
    const typeBRecords = await prisma.dailyInventory.findMany({
      where: { propertyId, roomTypeId: roomTypeBId },
    });
    for (const rec of typeBRecords) {
      expect(rec.totalRooms).toBe(1);
      expect(rec.version).toBe(1);
    }
  });

  it('2. Concurrency Suite: 10 concurrent requests for last room across 3 nights: exactly 1 succeeds, 9 receive 409 Conflict', async () => {
    // Setup RoomType C with 1 room available across 3 consecutive nights
    roomTypeCId = generateUuidV7();
    await prisma.roomType.create({
      data: {
        id: roomTypeCId,
        propertyId,
        code: `RTC_OCC_${testSuffix}`,
        name: 'Single Last Room Type',
        roomClass: 'STANDARD',
        bedConfiguration: [{ type: 'QUEEN', count: 1 }],
      },
    });

    const arrivalDate = new Date('2026-11-10T00:00:00.000Z');
    const departureDate = new Date('2026-11-13T00:00:00.000Z'); // 3 nights

    const nights = [
      new Date('2026-11-10T00:00:00.000Z'),
      new Date('2026-11-11T00:00:00.000Z'),
      new Date('2026-11-12T00:00:00.000Z'),
    ];

    for (const n of nights) {
      await prisma.dailyInventory.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          roomTypeId: roomTypeCId,
          businessDate: n,
          totalRooms: 1,
          outOfOrderCount: 0,
          outOfServiceCount: 0,
          blockedCount: 0,
          bookedCount: 0,
          overbookingLimit: 0,
          version: 0,
        },
      });
    }

    // Fire 10 concurrent reservation requests across 3 nights
    const attempts = Array.from({ length: 10 }, () =>
      inventoryService.reserveInventoryRange(
        propertyId,
        roomTypeCId,
        arrivalDate,
        departureDate,
        1,
      ),
    );

    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(9);

    // Verify all 9 rejections are ConflictException (409)
    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        expect(rej.reason).toBeInstanceOf(ConflictException);
      }
    }

    // Verify database state: bookedCount is 1, version is 1 for all 3 nights
    const rows = await prisma.dailyInventory.findMany({
      where: {
        propertyId,
        roomTypeId: roomTypeCId,
        businessDate: {
          gte: arrivalDate,
          lt: departureDate,
        },
      },
    });

    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.bookedCount).toBe(1);
      expect(row.version).toBe(1);
    }
  });
});
