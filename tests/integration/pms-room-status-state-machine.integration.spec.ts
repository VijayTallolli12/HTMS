import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { PropertyBusinessDateService } from '../../apps/api-core/src/modules/pms/common/services/property-business-date.service';
import { SystemClock } from '../../apps/api-core/src/modules/pms/common/services/system-clock.service';
import { AtsCalculatorService } from '../../apps/api-core/src/modules/pms/inventory/services/ats-calculator.service';
import { InventoryService } from '../../apps/api-core/src/modules/pms/inventory/services/inventory.service';
import { RoomStatusReconciliationService } from '../../apps/api-core/src/modules/pms/room-operations/services/room-status-reconciliation.service';
import { RoomStatusService } from '../../apps/api-core/src/modules/pms/room-operations/services/room-status.service';
import { RoomMaintenanceService } from '../../apps/api-core/src/modules/pms/room-operations/services/room-maintenance.service';
import { DefaultRoomDeactivationValidator } from '../../apps/api-core/src/modules/pms/rooms/services/default-room-deactivation-validator.service';
import {
  HousekeepingStatus,
  MaintenanceBlockType,
  PmsEventType,
  RoomOccupancyStatus,
  RoomServiceStatus,
  RoomStatusLogSource,
} from '@hms/api-contracts';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('W1-T06: Room Status State Machine & Reconciliation Integration Tests', () => {
  jest.setTimeout(60000);

  let prisma: PrismaClient;
  let prismaService: PrismaService;
  let dateService: PropertyBusinessDateService;
  let atsCalculator: AtsCalculatorService;
  let inventoryService: InventoryService;
  let reconciliationService: RoomStatusReconciliationService;
  let roomStatusService: RoomStatusService;
  let maintenanceService: RoomMaintenanceService;
  let deactivationValidator: DefaultRoomDeactivationValidator;

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
    reconciliationService = new RoomStatusReconciliationService(prismaService);
    roomStatusService = new RoomStatusService(prismaService, dateService, reconciliationService);
    maintenanceService = new RoomMaintenanceService(prismaService, inventoryService, dateService);
    deactivationValidator = new DefaultRoomDeactivationValidator(prismaService);

    // 1. Setup organization hierarchy
    hotelGroupId = generateUuidV7();
    await prisma.hotelGroup.create({
      data: { id: hotelGroupId, code: `GRP_STAT_${testSuffix}`, name: 'Status Test Group' },
    });

    regionId = generateUuidV7();
    await prisma.region.create({
      data: {
        id: regionId,
        hotelGroupId,
        code: `REG_STAT_${testSuffix}`,
        name: 'Status Test Region',
      },
    });

    countryId = generateUuidV7();
    await prisma.country.create({
      data: {
        id: countryId,
        regionId,
        code: `CO_${testSuffix}`.slice(0, 10),
        name: 'Status Country',
      },
    });

    propertyId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: propertyId,
        countryId,
        code: `PRP_STAT_${testSuffix}`,
        name: 'Status Test Property',
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
        name: 'Standard Room Type',
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
        roomNumber: '101',
        housekeepingStatus: HousekeepingStatus.DIRTY,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        isActive: true,
      },
    });

    // Seed 14 days of DailyInventory
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

  describe('Housekeeping State Transitions & Audit Trail', () => {
    it('progresses room from DIRTY -> CLEANING -> CLEAN -> INSPECTED', async () => {
      // 1. DIRTY -> CLEANING
      const resCleaning = await roomStatusService.updateHousekeepingStatus(
        propertyId,
        roomId,
        { housekeepingStatus: HousekeepingStatus.CLEANING, reason: 'Maid entered' },
        testUserId,
      );
      expect(resCleaning.housekeepingStatus).toBe(HousekeepingStatus.CLEANING);
      expect(resCleaning.effective.isCheckInReady).toBe(false);

      // 2. CLEANING -> CLEAN
      const resClean = await roomStatusService.updateHousekeepingStatus(
        propertyId,
        roomId,
        { housekeepingStatus: HousekeepingStatus.CLEAN, reason: 'Cleaning done' },
        testUserId,
      );
      expect(resClean.housekeepingStatus).toBe(HousekeepingStatus.CLEAN);
      expect(resClean.effective.isCheckInReady).toBe(false);

      // 3. CLEAN -> INSPECTED
      const resInspected = await roomStatusService.updateHousekeepingStatus(
        propertyId,
        roomId,
        { housekeepingStatus: HousekeepingStatus.INSPECTED, reason: 'Supervisor checked' },
        testUserId,
      );
      expect(resInspected.housekeepingStatus).toBe(HousekeepingStatus.INSPECTED);
      expect(resInspected.effective.isCheckInReady).toBe(true);

      // Verify audit logs in database
      const logs = await prisma.roomStatusLog.findMany({
        where: { propertyId, roomId },
        orderBy: { createdAt: 'asc' },
      });
      expect(logs.length).toBe(3);
      expect(logs[0].previousHousekeepingStatus).toBe(HousekeepingStatus.DIRTY);
      expect(logs[0].newHousekeepingStatus).toBe(HousekeepingStatus.CLEANING);
      expect(logs[0].source).toBe(RoomStatusLogSource.MANUAL);
      expect(logs[0].changedBy).toBe(testUserId);

      expect(logs[2].previousHousekeepingStatus).toBe(HousekeepingStatus.CLEAN);
      expect(logs[2].newHousekeepingStatus).toBe(HousekeepingStatus.INSPECTED);

      // Verify outbox events
      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          propertyId,
          type: PmsEventType.ROOM_STATUS_CHANGED,
        },
      });
      expect(outboxEvents.length).toBeGreaterThanOrEqual(3);
    });

    it('rejects forbidden transition INSPECTED -> CLEANING', async () => {
      await expect(
        roomStatusService.updateHousekeepingStatus(
          propertyId,
          roomId,
          { housekeepingStatus: HousekeepingStatus.CLEANING },
          testUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows INSPECTED -> PICKUP and then PICKUP -> INSPECTED', async () => {
      const resPickup = await roomStatusService.updateHousekeepingStatus(
        propertyId,
        roomId,
        { housekeepingStatus: HousekeepingStatus.PICKUP, reason: 'Vacant for 3 days' },
        testUserId,
      );
      expect(resPickup.housekeepingStatus).toBe(HousekeepingStatus.PICKUP);
      expect(resPickup.effective.isCheckInReady).toBe(false);

      const resInspected = await roomStatusService.updateHousekeepingStatus(
        propertyId,
        roomId,
        { housekeepingStatus: HousekeepingStatus.INSPECTED, reason: 'Touched up and re-inspected' },
        testUserId,
      );
      expect(resInspected.housekeepingStatus).toBe(HousekeepingStatus.INSPECTED);
      expect(resInspected.effective.isCheckInReady).toBe(true);
    });
  });

  describe('Lazy Reconciliation & Complete Materialized Projection', () => {
    it('reconciles expired maintenance block on read, restoring IN_SERVICE and enforcing DIRTY', async () => {
      const today = dateService.getCurrentBusinessDate('UTC');
      const yesterday = dateService.addDays(today, -2);
      const pastEnd = dateService.addDays(today, -1);

      // Create an expired maintenance block directly
      const pastBlockId = generateUuidV7();
      await prisma.roomMaintenanceBlock.create({
        data: {
          id: pastBlockId,
          propertyId,
          roomId,
          type: 'OUT_OF_ORDER',
          startDate: yesterday,
          endDate: pastEnd,
          reason: 'Pipe repair',
          status: 'ACTIVE',
          createdBy: testUserId,
        },
      });

      // Manually set room to OUT_OF_ORDER and CLEAN (as if it had been cleaned before expiry)
      await prisma.room.update({
        where: { id: roomId },
        data: {
          serviceStatus: RoomServiceStatus.OUT_OF_ORDER,
          housekeepingStatus: HousekeepingStatus.CLEAN,
        },
      });

      // Read the room status via findById -> triggers lazy reconciliation!
      const statusDto = await roomStatusService.findById(propertyId, roomId);

      // Must be restored to IN_SERVICE and housekeeping must be DIRTY (hygiene safety rule!)
      expect(statusDto.serviceStatus).toBe(RoomServiceStatus.IN_SERVICE);
      expect(statusDto.housekeepingStatus).toBe(HousekeepingStatus.DIRTY);
      expect(statusDto.effective.serviceStatus).toBe(RoomServiceStatus.IN_SERVICE);
      expect(statusDto.effective.housekeepingStatus).toBe(HousekeepingStatus.DIRTY);
      expect(statusDto.effective.isCheckInReady).toBe(false);

      // Verify reconciliation audit log
      const reconLog = await prisma.roomStatusLog.findFirst({
        where: {
          propertyId,
          roomId,
          source: RoomStatusLogSource.RECONCILIATION_EXPIRY,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(reconLog).toBeDefined();
      expect(reconLog?.newHousekeepingStatus).toBe(HousekeepingStatus.DIRTY);
      expect(reconLog?.newServiceStatus).toBe(RoomServiceStatus.IN_SERVICE);

      // Verify complete projection idempotency: another read is a TRUE NO-OP
      const beforeVersion = statusDto.version;
      const readAgain = await roomStatusService.findById(propertyId, roomId);
      expect(readAgain.version).toBe(beforeVersion);
    });

    it('prevents deactivation of room when active maintenance block exists', async () => {
      const today = dateService.getCurrentBusinessDate('UTC');
      const todayStr = today.toISOString().slice(0, 10);
      const tomorrowStr = dateService.addDays(today, 2).toISOString().slice(0, 10);

      // Create an active maintenance block covering today
      const res = await maintenanceService.create(
        propertyId,
        {
          roomId,
          type: MaintenanceBlockType.OUT_OF_ORDER,
          startDate: todayStr,
          endDate: tomorrowStr,
          reason: 'AC repair',
        },
        testUserId,
      );
      expect(res.maintenanceBlock.id).toBeDefined();

      // Check validator: canDeactivateOrDeleteRoom must return allowed: false
      const checkResult = await deactivationValidator.canDeactivateOrDeleteRoom(propertyId, roomId);
      expect(checkResult.allowed).toBe(false);
      expect(checkResult.reason).toContain('OUT_OF_ORDER');

      // Cancel the block
      await maintenanceService.cancel(
        propertyId,
        res.maintenanceBlock.id,
        { reason: 'Cancelled for deactivation test' },
        testUserId,
      );

      // Now deactivation validation should pass
      const afterCancelResult = await deactivationValidator.canDeactivateOrDeleteRoom(
        propertyId,
        roomId,
      );
      expect(afterCancelResult.allowed).toBe(true);
    });
  });
});
