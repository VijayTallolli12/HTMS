import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { PropertyBusinessDateService } from '../../apps/api-core/src/modules/pms/common/services/property-business-date.service';
import { SystemClock } from '../../apps/api-core/src/modules/pms/common/services/system-clock.service';
import { AtsCalculatorService } from '../../apps/api-core/src/modules/pms/inventory/services/ats-calculator.service';
import { InventoryService } from '../../apps/api-core/src/modules/pms/inventory/services/inventory.service';
import { RoomMaintenanceService } from '../../apps/api-core/src/modules/pms/room-operations/services/room-maintenance.service';
import {
  HousekeepingStatus,
  MaintenanceBlockStatus,
  MaintenanceBlockType,
  PmsEventType,
  RoomOccupancyStatus,
  RoomServiceStatus,
} from '@hms/api-contracts';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('W1-T06: Room Maintenance Concurrency & Exclusion Constraint Integration Tests', () => {
  jest.setTimeout(60000);

  let prisma: PrismaClient;
  let prismaService: PrismaService;
  let dateService: PropertyBusinessDateService;
  let atsCalculator: AtsCalculatorService;
  let inventoryService: InventoryService;
  let maintenanceService: RoomMaintenanceService;

  const testSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  let hotelGroupId: string;
  let regionId: string;
  let countryId: string;
  let propertyId: string;
  let roomTypeId: string;
  let buildingId: string;
  let floorId: string;
  let roomId: string;
  const testUserId = generateUuidV7();

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();

    prismaService = prisma as unknown as PrismaService;
    const clock = new SystemClock();
    dateService = new PropertyBusinessDateService(clock);
    atsCalculator = new AtsCalculatorService();
    inventoryService = new InventoryService(prismaService, dateService, atsCalculator);
    maintenanceService = new RoomMaintenanceService(prismaService, inventoryService, dateService);

    // 1. Setup organization hierarchy
    hotelGroupId = generateUuidV7();
    await prisma.hotelGroup.create({
      data: { id: hotelGroupId, code: `GRP_MNT_${testSuffix}`, name: 'Mnt Group' },
    });

    regionId = generateUuidV7();
    await prisma.region.create({
      data: {
        id: regionId,
        hotelGroupId,
        code: `REG_MNT_${testSuffix}`,
        name: 'Mnt Region',
      },
    });

    countryId = generateUuidV7();
    await prisma.country.create({
      data: {
        id: countryId,
        regionId,
        code: `CO_${testSuffix}`.slice(0, 10),
        name: 'Mnt Country',
      },
    });

    propertyId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: propertyId,
        countryId,
        code: `PRP_MNT_${testSuffix}`,
        name: 'Mnt Property',
        timeZone: 'UTC',
        currency: 'USD',
      },
    });

    buildingId = generateUuidV7();
    await prisma.building.create({
      data: {
        id: buildingId,
        propertyId,
        name: 'Main Building',
        code: `BLD_${testSuffix}`.slice(0, 10),
      },
    });

    floorId = generateUuidV7();
    await prisma.floor.create({
      data: {
        id: floorId,
        buildingId,
        floorNumber: 1,
        code: `FL_${testSuffix}`.slice(0, 10),
        name: 'First Floor',
      },
    });

    roomTypeId = generateUuidV7();
    await prisma.roomType.create({
      data: {
        id: roomTypeId,
        propertyId,
        code: `RT_${testSuffix}`.slice(0, 10),
        name: 'Mnt Room Type',
        roomClass: 'STANDARD',
        baseOccupancy: 2,
        maxOccupancy: 2,
        maxAdults: 2,
        maxChildren: 0,
        bedConfiguration: [],
      },
    });

    roomId = generateUuidV7();
    await prisma.room.create({
      data: {
        id: roomId,
        propertyId,
        buildingId,
        floorId,
        roomTypeId,
        roomNumber: '201',
        housekeepingStatus: HousekeepingStatus.CLEAN,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        isActive: true,
      },
    });

    // Seed 14 days of DailyInventory with 5 total rooms
    const today = dateService.getCurrentBusinessDate('UTC');
    for (let i = 0; i < 14; i++) {
      const bDate = dateService.addDays(today, i);
      await prisma.dailyInventory.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          roomTypeId,
          businessDate: bDate,
          totalRooms: 5,
          bookedCount: 0,
          outOfOrderCount: 0,
          outOfServiceCount: 0,
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.roomStatusLog.deleteMany({ where: { propertyId } });
    await prisma.roomMaintenanceBlock.deleteMany({ where: { propertyId } });
    await prisma.outboxEvent.deleteMany({ where: { propertyId } });
    await prisma.dailyInventory.deleteMany({ where: { propertyId } });
    await prisma.room.deleteMany({ where: { propertyId } });
    await prisma.roomType.deleteMany({ where: { propertyId } });
    await prisma.floor.deleteMany({ where: { buildingId } });
    await prisma.building.deleteMany({ where: { propertyId } });
    await prisma.property.deleteMany({ where: { id: propertyId } });
    await prisma.country.deleteMany({ where: { id: countryId } });
    await prisma.region.deleteMany({ where: { id: regionId } });
    await prisma.hotelGroup.deleteMany({ where: { id: hotelGroupId } });
    await prisma.$disconnect();
  });

  describe('PostgreSQL GiST Exclusion Constraint & Overlap Concurrency', () => {
    it('handles 10 concurrent requests to create overlapping maintenance blocks: EXACTLY 1 succeeds, 9 fail with 409', async () => {
      const today = dateService.getCurrentBusinessDate('UTC');
      const startStr = dateService.addDays(today, 1).toISOString().slice(0, 10);
      const endStr = dateService.addDays(today, 3).toISOString().slice(0, 10);

      const promises = Array.from({ length: 10 }, (_, i) =>
        maintenanceService
          .create(
            propertyId,
            {
              roomId,
              type: MaintenanceBlockType.OUT_OF_ORDER,
              startDate: startStr,
              endDate: endStr,
              reason: `Concurrent attempt #${i + 1}`,
            },
            testUserId,
          )
          .then((res) => ({ success: true as const, res }))
          .catch((err) => ({ success: false as const, err })),
      );

      const results = await Promise.all(promises);

      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      try {
        expect(successes.length).toBe(1);
        expect(failures.length).toBe(9);

        // Every single failure must be an HTTP 409 ConflictException
        for (const f of failures) {
          if (!f.success) {
            expect(f.err).toBeInstanceOf(ConflictException);
          }
        }

        // Check DailyInventory: outOfOrderCount must have incremented by EXACTLY 1, NOT 10!
        const inventoryRows = await prisma.dailyInventory.findMany({
          where: {
            propertyId,
            roomTypeId,
            businessDate: {
              gte: new Date(`${startStr}T00:00:00.000Z`),
              lt: new Date(`${endStr}T00:00:00.000Z`),
            },
          },
        });

        for (const row of inventoryRows) {
          expect(row.outOfOrderCount).toBe(1);
        }
      } finally {
        if (successes.length > 0) {
          const createdBlock = (successes[0] as any).res.maintenanceBlock;
          await maintenanceService.cancel(
            propertyId,
            createdBlock.id,
            { reason: 'Clean up concurrency test block' },
            testUserId,
          );
        }
      }
    });

    it('allows adjacent blocks [s1, e1) and [e1, e2) to coexist without exclusion conflict', async () => {
      const today = dateService.getCurrentBusinessDate('UTC');
      const d1Str = dateService.addDays(today, 4).toISOString().slice(0, 10);
      const d2Str = dateService.addDays(today, 6).toISOString().slice(0, 10);
      const d3Str = dateService.addDays(today, 8).toISOString().slice(0, 10);

      // Block 1: [d1, d2)
      const block1 = await maintenanceService.create(
        propertyId,
        {
          roomId,
          type: MaintenanceBlockType.OUT_OF_ORDER,
          startDate: d1Str,
          endDate: d2Str,
          reason: 'Window painting',
        },
        testUserId,
      );
      expect(block1.maintenanceBlock.id).toBeDefined();

      // Block 2: [d2, d3) - adjacent to Block 1 on d2 boundary
      const block2 = await maintenanceService.create(
        propertyId,
        {
          roomId,
          type: MaintenanceBlockType.OUT_OF_SERVICE,
          startDate: d2Str,
          endDate: d3Str,
          reason: 'Deep cleaning',
        },
        testUserId,
      );
      expect(block2.maintenanceBlock.id).toBeDefined();

      // Verify both are ACTIVE in database
      const activeBlocks = await prisma.roomMaintenanceBlock.findMany({
        where: {
          propertyId,
          roomId,
          status: 'ACTIVE',
          id: { in: [block1.maintenanceBlock.id, block2.maintenanceBlock.id] },
        },
      });
      expect(activeBlocks.length).toBe(2);

      // Clean up
      await maintenanceService.cancel(
        propertyId,
        block1.maintenanceBlock.id,
        { reason: 'Adjacent test cleanup 1' },
        testUserId,
      );
      await maintenanceService.cancel(
        propertyId,
        block2.maintenanceBlock.id,
        { reason: 'Adjacent test cleanup 2' },
        testUserId,
      );
    });
  });

  describe('Atomic OOO <-> OOS Replacement', () => {
    it('replaces active OUT_OF_ORDER block with OUT_OF_SERVICE block atomically', async () => {
      const today = dateService.getCurrentBusinessDate('UTC');
      const todayStr = today.toISOString().slice(0, 10);
      const endStr = dateService.addDays(today, 3).toISOString().slice(0, 10);

      // 1. Create active OOO block starting today
      const createRes = await maintenanceService.create(
        propertyId,
        {
          roomId,
          type: MaintenanceBlockType.OUT_OF_ORDER,
          startDate: todayStr,
          endDate: endStr,
          reason: 'Initial OOO block',
        },
        testUserId,
      );
      const initialBlockId = createRes.maintenanceBlock.id;

      // Verify initial state
      let inv = await prisma.dailyInventory.findFirstOrThrow({
        where: {
          propertyId,
          roomTypeId,
          businessDate: today,
        },
      });
      expect(inv.outOfOrderCount).toBe(1);
      expect(inv.outOfServiceCount).toBe(0);

      let room = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
      expect(room.serviceStatus).toBe(RoomServiceStatus.OUT_OF_ORDER);

      // 2. Execute atomic replacement to OUT_OF_SERVICE
      const replaceRes = await maintenanceService.replace(
        propertyId,
        initialBlockId,
        {
          newType: MaintenanceBlockType.OUT_OF_SERVICE,
          reason: 'Downgraded severity to OOS',
        },
        testUserId,
      );

      const newBlock = replaceRes.maintenanceBlock;
      expect(newBlock.type).toBe(MaintenanceBlockType.OUT_OF_SERVICE);
      expect(newBlock.status).toBe(MaintenanceBlockStatus.ACTIVE);

      // 3. Verify old block was CANCELLED
      const oldBlock = await prisma.roomMaintenanceBlock.findUniqueOrThrow({
        where: { id: initialBlockId },
      });
      expect(oldBlock.status).toBe(MaintenanceBlockStatus.CANCELLED);

      // 4. Verify DailyInventory counters: OOO decremented to 0, OOS incremented to 1
      inv = await prisma.dailyInventory.findFirstOrThrow({
        where: {
          propertyId,
          roomTypeId,
          businessDate: today,
        },
      });
      expect(inv.outOfOrderCount).toBe(0);
      expect(inv.outOfServiceCount).toBe(1);

      // 5. Verify room serviceStatus updated to OUT_OF_SERVICE
      room = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
      expect(room.serviceStatus).toBe(RoomServiceStatus.OUT_OF_SERVICE);

      // 6. Verify Outbox events emitted
      const endedEvents = await prisma.outboxEvent.findMany({
        where: {
          propertyId,
          type: PmsEventType.ROOM_MAINTENANCE_ENDED,
          subject: initialBlockId,
        },
      });
      expect(endedEvents.length).toBe(1);

      const createdEvents = await prisma.outboxEvent.findMany({
        where: {
          propertyId,
          type: PmsEventType.ROOM_MAINTENANCE_CREATED,
          subject: newBlock.id,
        },
      });
      expect(createdEvents.length).toBe(1);

      // Clean up
      await maintenanceService.cancel(
        propertyId,
        newBlock.id,
        { reason: 'Clean up replacement test' },
        testUserId,
      );
    });
  });

  describe('Overbooking Advisory & ATS Impact', () => {
    it('generates an advisory warning when maintenance block causes bookings to exceed available rooms', async () => {
      const today = dateService.getCurrentBusinessDate('UTC');
      const targetDate = dateService.addDays(today, 10);
      const targetStr = targetDate.toISOString().slice(0, 10);
      const nextDayStr = dateService.addDays(today, 11).toISOString().slice(0, 10);

      // Set bookedCount = 5 (all 5 rooms booked) on targetDate
      await prisma.dailyInventory.updateMany({
        where: {
          propertyId,
          roomTypeId,
          businessDate: targetDate,
        },
        data: {
          bookedCount: 5,
        },
      });

      // Now create an OOO block for that night
      const res = await maintenanceService.create(
        propertyId,
        {
          roomId,
          type: MaintenanceBlockType.OUT_OF_ORDER,
          startDate: targetStr,
          endDate: nextDayStr,
          reason: 'Emergency electrical check',
        },
        testUserId,
      );

      // Expect advisory warning because 5 booked > (5 total - 1 OOO = 4 available)
      expect(res.advisory).toBeDefined();
      expect(res.advisory?.hasOverbookingRisk).toBe(true);
      expect(res.advisory?.affectedDates).toContain(targetStr);

      // Clean up
      await maintenanceService.cancel(
        propertyId,
        res.maintenanceBlock.id,
        { reason: 'Clean up advisory test' },
        testUserId,
      );
    });
  });
});
