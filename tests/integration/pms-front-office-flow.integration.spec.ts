import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { PropertyBusinessDateService } from '../../apps/api-core/src/modules/pms/common/services/property-business-date.service';
import { SystemClock } from '../../apps/api-core/src/modules/pms/common/services/system-clock.service';
import { AtsCalculatorService } from '../../apps/api-core/src/modules/pms/inventory/services/ats-calculator.service';
import { InventoryService } from '../../apps/api-core/src/modules/pms/inventory/services/inventory.service';
import { ReservationService } from '../../apps/api-core/src/modules/pms/reservations/services/reservation.service';
import { RoomMaintenanceService } from '../../apps/api-core/src/modules/pms/room-operations/services/room-maintenance.service';
import { RoomStatusService } from '../../apps/api-core/src/modules/pms/room-operations/services/room-status.service';
import { RoomStatusReconciliationService } from '../../apps/api-core/src/modules/pms/room-operations/services/room-status-reconciliation.service';
import { RoomAssignmentService } from '../../apps/api-core/src/modules/pms/front-office/services/room-assignment.service';
import { CheckInService } from '../../apps/api-core/src/modules/pms/front-office/services/check-in.service';
import {
  HousekeepingStatus,
  MaintenanceBlockType,
  PmsEventType,
  ReservationStatus,
  RoomOccupancyStatus,
  RoomServiceStatus,
  SecurityContext,
} from '@hms/api-contracts';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('W1-T07: Front Office Room Assignment & Arrival Processing Integration Tests', () => {
  jest.setTimeout(60000);

  let prisma: PrismaClient;
  let prismaService: PrismaService;
  let dateService: PropertyBusinessDateService;
  let atsCalculator: AtsCalculatorService;
  let inventoryService: InventoryService;
  let reservationService: ReservationService;
  let roomStatusService: RoomStatusService;
  let maintenanceService: RoomMaintenanceService;
  let reconciliationService: RoomStatusReconciliationService;
  let assignmentService: RoomAssignmentService;
  let checkInService: CheckInService;

  const testSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  let hotelGroupId: string;
  let regionId: string;
  let countryId: string;
  let propertyId: string;
  let roomTypeId: string;
  let upgradeRoomTypeId: string;
  let ratePlanId: string;
  let buildingId: string;
  let floorId: string;
  let roomId1: string;
  let roomId2: string;
  let roomId3: string;
  const testUserId = generateUuidV7();

  const standardActorContext: SecurityContext = {
    userId: testUserId,
    sessionId: 'test-session',
    correlationId: 'test-corr',
    activeContext: {
      hotelGroupId: null,
      propertyId: '', // set in beforeAll
    },
    user: {
      id: testUserId,
      email: 'frontdesk@example.com',
      firstName: 'Front',
      lastName: 'Desk',
      status: 'ACTIVE',
    },
    isGlobalAdmin: false,
    roles: Object.freeze([]),
    permissions: new Set(['front_office.room_assignment.manage', 'front_office.checkin.execute']),
    scopes: Object.freeze([]),
  };

  const supervisorActorContext: SecurityContext = {
    ...standardActorContext,
    permissions: new Set([
      'front_office.room_assignment.manage',
      'front_office.room_assignment.upgrade',
      'front_office.checkin.execute',
      'front_office.checkin.clean_override',
    ]),
  };

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();

    prismaService = prisma as unknown as PrismaService;
    const clock = new SystemClock();
    dateService = new PropertyBusinessDateService(clock);
    atsCalculator = new AtsCalculatorService();
    inventoryService = new InventoryService(prismaService, dateService, atsCalculator);
    reservationService = new ReservationService(prismaService, inventoryService, dateService);
    reconciliationService = new RoomStatusReconciliationService(prismaService);
    roomStatusService = new RoomStatusService(prismaService, dateService, reconciliationService);
    maintenanceService = new RoomMaintenanceService(prismaService, inventoryService, dateService);
    assignmentService = new RoomAssignmentService(
      prismaService,
      dateService,
      reconciliationService,
    );
    checkInService = new CheckInService(prismaService, dateService, roomStatusService);

    // 1. Organization hierarchy
    hotelGroupId = generateUuidV7();
    await prisma.hotelGroup.create({
      data: { id: hotelGroupId, code: `GRP_FO_${testSuffix}`, name: 'FrontOffice Group' },
    });

    regionId = generateUuidV7();
    await prisma.region.create({
      data: {
        id: regionId,
        hotelGroupId,
        code: `REG_FO_${testSuffix}`,
        name: 'FrontOffice Region',
      },
    });

    countryId = generateUuidV7();
    await prisma.country.create({
      data: {
        id: countryId,
        regionId,
        code: `CO_${testSuffix}`.slice(0, 10),
        name: 'FrontOffice Country',
      },
    });

    propertyId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: propertyId,
        countryId,
        code: `PRP_FO_${testSuffix}`,
        name: 'FrontOffice Property',
        timeZone: 'UTC',
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    (standardActorContext.activeContext as any).propertyId = propertyId;
    (supervisorActorContext.activeContext as any).propertyId = propertyId;

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

    // 2. Room Types (standard & suite)
    roomTypeId = generateUuidV7();
    await prisma.roomType.create({
      data: {
        id: roomTypeId,
        propertyId,
        code: `STD_${testSuffix}`.slice(0, 10),
        name: 'Standard King',
        roomClass: 'STANDARD',
        baseOccupancy: 2,
        maxOccupancy: 2,
        maxAdults: 2,
        maxChildren: 0,
        bedConfiguration: [],
      },
    });

    upgradeRoomTypeId = generateUuidV7();
    await prisma.roomType.create({
      data: {
        id: upgradeRoomTypeId,
        propertyId,
        code: `SUI_${testSuffix}`.slice(0, 10),
        name: 'Executive Suite',
        roomClass: 'SUITE',
        baseOccupancy: 2,
        maxOccupancy: 4,
        maxAdults: 4,
        maxChildren: 2,
        bedConfiguration: [],
      },
    });

    // 3. Physical Rooms
    roomId1 = generateUuidV7();
    await prisma.room.create({
      data: {
        id: roomId1,
        propertyId,
        buildingId,
        floorId,
        roomTypeId,
        roomNumber: '101',
        housekeepingStatus: HousekeepingStatus.INSPECTED,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        isActive: true,
        version: 0,
      },
    });

    roomId2 = generateUuidV7();
    await prisma.room.create({
      data: {
        id: roomId2,
        propertyId,
        buildingId,
        floorId,
        roomTypeId,
        roomNumber: '102',
        housekeepingStatus: HousekeepingStatus.CLEAN,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        isActive: true,
        version: 0,
      },
    });

    roomId3 = generateUuidV7();
    await prisma.room.create({
      data: {
        id: roomId3,
        propertyId,
        buildingId,
        floorId,
        roomTypeId: upgradeRoomTypeId,
        roomNumber: '201',
        housekeepingStatus: HousekeepingStatus.INSPECTED,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        isActive: true,
        version: 0,
      },
    });

    // 4. Rate Plan & Mapping
    ratePlanId = generateUuidV7();
    await prisma.ratePlan.create({
      data: {
        id: ratePlanId,
        propertyId,
        code: `RP_FO_${testSuffix}`.slice(0, 10),
        name: 'Standard BAR',
        currency: 'USD',
        minStayDays: 1,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: new Date('2026-12-31T00:00:00.000Z'),
      },
    });

    await prisma.ratePlanRoomType.createMany({
      data: [
        {
          id: generateUuidV7(),
          propertyId,
          ratePlanId,
          roomTypeId,
          baseRateAmount: 150,
          extraAdultRate: 25,
          extraChildRate: 15,
          isActive: true,
        },
        {
          id: generateUuidV7(),
          propertyId,
          ratePlanId,
          roomTypeId: upgradeRoomTypeId,
          baseRateAmount: 300,
          extraAdultRate: 50,
          extraChildRate: 25,
          isActive: true,
        },
      ],
    });

    // 5. Daily Inventory
    const invData = [];
    const baseDate = new Date();
    baseDate.setUTCHours(0, 0, 0, 0);
    for (let i = -1; i < 15; i++) {
      const d = new Date(baseDate.getTime());
      d.setUTCDate(d.getUTCDate() + i);
      invData.push(
        {
          id: generateUuidV7(),
          propertyId,
          roomTypeId,
          businessDate: d,
          totalRooms: 20,
          bookedCount: 0,
          version: 0,
        },
        {
          id: generateUuidV7(),
          propertyId,
          roomTypeId: upgradeRoomTypeId,
          businessDate: d,
          totalRooms: 20,
          bookedCount: 0,
          version: 0,
        },
      );
    }
    await prisma.dailyInventory.createMany({ data: invData });
  });

  afterAll(async () => {
    try {
      await prisma.outboxEvent.deleteMany({ where: { propertyId } });
      await prisma.reservationAssignmentLog.deleteMany({ where: { propertyId } });
      await prisma.roomStatusLog.deleteMany({ where: { propertyId } });
      await prisma.roomMaintenanceBlock.deleteMany({ where: { propertyId } });
      await prisma.reservationRateNight.deleteMany({ where: { propertyId } });
      await prisma.reservation.deleteMany({ where: { propertyId } });
      await prisma.guest.deleteMany({ where: { propertyId } });
      await prisma.dailyInventory.deleteMany({ where: { propertyId } });
      await prisma.ratePlanRoomType.deleteMany({ where: { propertyId } });
      await prisma.ratePlan.deleteMany({ where: { propertyId } });
      await prisma.room.deleteMany({ where: { propertyId } });
      await prisma.roomType.deleteMany({ where: { propertyId } });
      await prisma.floor.deleteMany({ where: { buildingId } });
      await prisma.building.deleteMany({ where: { propertyId } });
      await prisma.property.deleteMany({ where: { id: propertyId } });
      await prisma.country.deleteMany({ where: { id: countryId } });
      await prisma.region.deleteMany({ where: { id: regionId } });
      await prisma.hotelGroup.deleteMany({ where: { id: hotelGroupId } });
    } finally {
      await prisma.$disconnect();
    }
  });

  afterEach(async () => {
    await prisma.outboxEvent.deleteMany({ where: { propertyId } });
    await prisma.reservationAssignmentLog.deleteMany({ where: { propertyId } });
    await prisma.roomStatusLog.deleteMany({ where: { propertyId } });
    await prisma.roomMaintenanceBlock.deleteMany({ where: { propertyId } });
    await prisma.reservationRateNight.deleteMany({ where: { propertyId } });
    await prisma.reservation.deleteMany({ where: { propertyId } });
    await prisma.guest.deleteMany({ where: { propertyId } });
    await prisma.dailyInventory.updateMany({
      where: { propertyId },
      data: { bookedCount: 0 },
    });
    await prisma.room.updateMany({
      where: { id: { in: [roomId1, roomId3] } },
      data: {
        housekeepingStatus: HousekeepingStatus.INSPECTED,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
      },
    });
    await prisma.room.updateMany({
      where: { id: roomId2 },
      data: {
        housekeepingStatus: HousekeepingStatus.CLEAN,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
      },
    });
  });

  // Helper to create a confirmed reservation
  async function createTestReservation(arrOffset = 0, depOffset = 2, rTypeId = roomTypeId) {
    const today = dateService.getCurrentBusinessDate('UTC');
    const arrDate = new Date(today);
    arrDate.setUTCDate(arrDate.getUTCDate() + arrOffset);
    const depDate = new Date(today);
    depDate.setUTCDate(depDate.getUTCDate() + depOffset);

    return reservationService.create(propertyId, {
      roomTypeId: rTypeId,
      ratePlanId,
      arrivalDate: arrDate.toISOString().slice(0, 10),
      departureDate: depDate.toISOString().slice(0, 10),
      adultsCount: 2,
      childrenCount: 0,
      guest: {
        firstName: 'Test',
        lastName: 'Guest',
        email: `guest_${generateUuidV7().slice(0, 8)}@example.com`,
      },
    });
  }

  describe('1. Room Assignment Workflow', () => {
    it('successfully assigns an inspected room of matching room type and records log & outbox event', async () => {
      const res = await createTestReservation(0, 2);

      // Query eligible rooms
      const eligible = await assignmentService.getEligibleRooms(propertyId, {
        reservationId: res.id,
      });
      expect(eligible.length).toBeGreaterThanOrEqual(1);
      const eligibleIds = eligible.map((r) => r.id);
      expect(eligibleIds).toContain(roomId1);

      // Assign Room 101
      const assigned = await assignmentService.assignRoom(
        propertyId,
        res.id,
        {
          roomId: roomId1,
          reason: 'Assigned on arrival day',
        },
        standardActorContext,
      );

      expect(assigned.assignedRoomId).toBe(roomId1);
      expect(assigned.assignedAt).toBeDefined();
      expect(assigned.assignedBy).toBe(testUserId);
      expect(assigned.assignedRoom?.roomNumber).toBe('101');

      // Verify ReservationAssignmentLog
      const log = await prisma.reservationAssignmentLog.findFirst({
        where: { reservationId: res.id, newRoomId: roomId1 },
      });
      expect(log).toBeDefined();
      expect(log?.action).toBe('ASSIGN');
      expect(log?.previousRoomId).toBeNull();
      expect(log?.actorId).toBe(testUserId);

      // Verify Outbox Event
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          propertyId,
          type: PmsEventType.ROOM_ASSIGNED,
          subject: res.id,
        },
      });
      expect(outbox).toBeDefined();
      const payload = outbox?.data as any;
      expect(payload?.roomId).toBe(roomId1);
    });

    it('returns same reservation without version bump or extra log on same-room NO-OP assignment', async () => {
      const res = await createTestReservation(0, 2);
      const first = await assignmentService.assignRoom(
        propertyId,
        res.id,
        {
          roomId: roomId1,
        },
        standardActorContext,
      );

      const logsBefore = await prisma.reservationAssignmentLog.count({
        where: { reservationId: res.id },
      });

      const second = await assignmentService.assignRoom(
        propertyId,
        res.id,
        {
          roomId: roomId1,
        },
        standardActorContext,
      );

      expect(second.version).toBe(first.version);
      const logsAfter = await prisma.reservationAssignmentLog.count({
        where: { reservationId: res.id },
      });
      expect(logsAfter).toBe(logsBefore);
    });

    it('reassigns reservation to another room with lock ordering and records REASSIGN log', async () => {
      const res = await createTestReservation(0, 2);
      await assignmentService.assignRoom(
        propertyId,
        res.id,
        {
          roomId: roomId1,
        },
        standardActorContext,
      );

      const reassigned = await assignmentService.assignRoom(
        propertyId,
        res.id,
        {
          roomId: roomId2,
          reason: 'Moved to 102',
        },
        standardActorContext,
      );

      expect(reassigned.assignedRoomId).toBe(roomId2);

      const log = await prisma.reservationAssignmentLog.findFirst({
        where: { reservationId: res.id, action: 'REASSIGN' },
      });
      expect(log).toBeDefined();
      expect(log?.previousRoomId).toBe(roomId1);
      expect(log?.newRoomId).toBe(roomId2);
    });

    it('rejects complimentary upgrade without upgrade permission and succeeds with supervisor permission', async () => {
      const res = await createTestReservation(0, 2);

      // Attempt assignment to upgradeRoomTypeId without upgrade permission
      await expect(
        assignmentService.assignRoom(
          propertyId,
          res.id,
          {
            roomId: roomId3,
            allowUpgrade: true,
          },
          standardActorContext,
        ),
      ).rejects.toThrow(ForbiddenException);

      // With supervisor context
      const upgraded = await assignmentService.assignRoom(
        propertyId,
        res.id,
        {
          roomId: roomId3,
          allowUpgrade: true,
          reason: 'VIP complimentary upgrade',
        },
        supervisorActorContext,
      );

      expect(upgraded.assignedRoomId).toBe(roomId3);
      expect(upgraded.roomTypeId).toBe(roomTypeId); // Reserved room type remains intact!
    });

    it('unassigns an assigned room cleanly and returns NO-OP when unassigning already unassigned reservation', async () => {
      const res = await createTestReservation(0, 2);
      await assignmentService.assignRoom(
        propertyId,
        res.id,
        {
          roomId: roomId1,
        },
        standardActorContext,
      );

      const unassigned = await assignmentService.unassignRoom(
        propertyId,
        res.id,
        {
          reason: 'Guest requested room change later',
        },
        standardActorContext,
      );

      expect(unassigned.assignedRoomId).toBeNull();
      expect(unassigned.assignedAt).toBeNull();

      const log = await prisma.reservationAssignmentLog.findFirst({
        where: { reservationId: res.id, action: 'UNASSIGN' },
      });
      expect(log).toBeDefined();
      expect(log?.previousRoomId).toBe(roomId1);

      // Second unassign NO-OP
      const noop = await assignmentService.unassignRoom(
        propertyId,
        res.id,
        {},
        standardActorContext,
      );
      expect(noop.assignedRoomId).toBeNull();
      expect(noop.version).toBe(unassigned.version);
    });
  });

  describe('2. Guest Check-In Workflow', () => {
    it('successfully checks in reservation with inspected room, updates room occupancy to OCCUPIED and emits events', async () => {
      const res = await createTestReservation(0, 2);
      await assignmentService.assignRoom(
        propertyId,
        res.id,
        {
          roomId: roomId1,
        },
        standardActorContext,
      );

      // Room is currently VACANT and INSPECTED
      const checkedIn = await checkInService.checkIn(
        propertyId,
        res.id,
        {
          identityVerified: true,
          registrationCardSigned: true,
        },
        standardActorContext,
        'idemp-checkin-1',
      );

      expect(checkedIn.reservation.status).toBe(ReservationStatus.CHECKED_IN);
      expect(checkedIn.reservation.checkInAt).toBeDefined();
      expect(checkedIn.reservation.checkedInBy).toBe(testUserId);

      // Verify physical room status updated via RoomStatusService
      const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId1 } });
      expect(room.occupancyStatus).toBe(RoomOccupancyStatus.OCCUPIED);

      // Verify Outbox Events
      const guestCheckInEvent = await prisma.outboxEvent.findFirst({
        where: {
          propertyId,
          type: PmsEventType.GUEST_CHECKED_IN,
          subject: res.id,
        },
      });
      expect(guestCheckInEvent).toBeDefined();

      const roomOccEvent = await prisma.outboxEvent.findFirst({
        where: {
          propertyId,
          type: PmsEventType.ROOM_OCCUPANCY_CHANGED,
          subject: roomId1,
        },
      });
      expect(roomOccEvent).toBeDefined();
    });

    it('rejects check-in if room is CLEAN without supervisor clean_override permission', async () => {
      // Revert roomId2 to VACANT CLEAN
      await prisma.room.update({
        where: { id: roomId2 },
        data: {
          occupancyStatus: RoomOccupancyStatus.VACANT,
          housekeepingStatus: HousekeepingStatus.CLEAN,
        },
      });

      const res = await createTestReservation(0, 2);
      await assignmentService.assignRoom(
        propertyId,
        res.id,
        {
          roomId: roomId2,
        },
        standardActorContext,
      );

      await expect(
        checkInService.checkIn(
          propertyId,
          res.id,
          {
            identityVerified: true,
            registrationCardSigned: true,
          },
          standardActorContext,
          'idemp-checkin-clean-fail',
        ),
      ).rejects.toThrow(ConflictException);

      // With supervisor permission and clean override
      const checkedIn = await checkInService.checkIn(
        propertyId,
        res.id,
        {
          identityVerified: true,
          registrationCardSigned: true,
          allowCleanOverride: true,
          overrideReason: 'VIP early arrival requested Clean room',
        },
        supervisorActorContext,
        'idemp-checkin-clean-pass',
      );

      expect(checkedIn.reservation.status).toBe(ReservationStatus.CHECKED_IN);
    });

    it('rejects check-in if arrival date is in the future relative to business date', async () => {
      const res = await createTestReservation(1, 3); // Tomorrow
      await assignmentService.assignRoom(
        propertyId,
        res.id,
        {
          roomId: roomId1,
        },
        standardActorContext,
      );

      await expect(
        checkInService.checkIn(
          propertyId,
          res.id,
          {
            identityVerified: true,
          },
          standardActorContext,
          'idemp-future-checkin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns exact same response when repeating check-in with same idempotency key and payload (Case A)', async () => {
      // Revert roomId1 to VACANT INSPECTED
      await prisma.room.update({
        where: { id: roomId1 },
        data: {
          occupancyStatus: RoomOccupancyStatus.VACANT,
          housekeepingStatus: HousekeepingStatus.INSPECTED,
        },
      });

      const res = await createTestReservation(0, 2);
      await assignmentService.assignRoom(
        propertyId,
        res.id,
        {
          roomId: roomId1,
        },
        standardActorContext,
      );

      const payload = {
        identityVerified: true,
        registrationCardSigned: true,
      };

      const res1 = await checkInService.checkIn(
        propertyId,
        res.id,
        payload,
        standardActorContext,
        'idemp-key-case-a',
      );
      const res2 = await checkInService.checkIn(
        propertyId,
        res.id,
        payload,
        standardActorContext,
        'idemp-key-case-a',
      );

      expect(res1.reservation.id).toBe(res2.reservation.id);
      expect(res1.reservation.version).toBe(res2.reservation.version);
      expect(res1.reservation.checkInAt).toBe(res2.reservation.checkInAt);
    });

    it('rejects repeated check-in with same key but different payload with 409 Conflict (Case C)', async () => {
      // Revert roomId1 to VACANT INSPECTED
      await prisma.room.update({
        where: { id: roomId1 },
        data: {
          occupancyStatus: RoomOccupancyStatus.VACANT,
          housekeepingStatus: HousekeepingStatus.INSPECTED,
        },
      });

      const res = await createTestReservation(0, 2);
      await assignmentService.assignRoom(
        propertyId,
        res.id,
        {
          roomId: roomId1,
        },
        standardActorContext,
      );

      await checkInService.checkIn(
        propertyId,
        res.id,
        {
          identityVerified: true,
        },
        standardActorContext,
        'idemp-key-case-c',
      );

      await expect(
        checkInService.checkIn(
          propertyId,
          res.id,
          {
            identityVerified: false, // Modified payload
          },
          standardActorContext,
          'idemp-key-case-c',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('3. Concurrency & Integrity Validations', () => {
    it('prevents overlapping room assignment via GiST exclusion constraint and OCC', async () => {
      // Create two distinct confirmed reservations overlapping on same dates
      const resA = await createTestReservation(5, 8);
      const resB = await createTestReservation(6, 9);

      // Assign resA to roomId1 first
      await assignmentService.assignRoom(
        propertyId,
        resA.id,
        { roomId: roomId1 },
        standardActorContext,
      );

      // Attempt assigning resB to roomId1 -> should fail because of reservation dates overlap
      await expect(
        assignmentService.assignRoom(
          propertyId,
          resB.id,
          { roomId: roomId1 },
          standardActorContext,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('prevents cross-table race between Room Assignment and Maintenance creation via Room version OCC', async () => {
      const res = await createTestReservation(10, 13);
      const today = dateService.getCurrentBusinessDate('UTC');
      const startD = new Date(today);
      startD.setUTCDate(startD.getUTCDate() + 10);
      const endD = new Date(today);
      endD.setUTCDate(endD.getUTCDate() + 13);

      // Ensure room is VACANT INSPECTED
      await prisma.room.update({
        where: { id: roomId1 },
        data: {
          occupancyStatus: RoomOccupancyStatus.VACANT,
          housekeepingStatus: HousekeepingStatus.INSPECTED,
        },
      });

      // Run concurrent Assignment and Maintenance Creation
      const assignPromise = assignmentService.assignRoom(
        propertyId,
        res.id,
        { roomId: roomId1 },
        standardActorContext,
      );
      const maintenancePromise = maintenanceService.create(
        propertyId,
        {
          roomId: roomId1,
          type: MaintenanceBlockType.OUT_OF_ORDER,
          startDate: startD.toISOString().slice(0, 10),
          endDate: endD.toISOString().slice(0, 10),
          reason: 'Plumbing leak test',
        },
        testUserId,
      );

      const results = await Promise.allSettled([assignPromise, maintenancePromise]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly one must succeed and the other must fail due to Room version OCC or conflict validation
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
    });

    it('handles concurrent check-in race with identical idempotency key gracefully', async () => {
      // Revert roomId1 to VACANT INSPECTED
      await prisma.room.update({
        where: { id: roomId1 },
        data: {
          occupancyStatus: RoomOccupancyStatus.VACANT,
          housekeepingStatus: HousekeepingStatus.INSPECTED,
        },
      });

      const res = await createTestReservation(0, 2);
      await assignmentService.assignRoom(
        propertyId,
        res.id,
        {
          roomId: roomId1,
        },
        standardActorContext,
      );

      const sharedKey = `concurrent-race-key-${generateUuidV7()}`;
      const payload = {
        identityVerified: true,
        registrationCardSigned: true,
      };

      // Two concurrent calls with the exact same idempotency key
      const [result1, result2] = await Promise.all([
        checkInService.checkIn(propertyId, res.id, payload, standardActorContext, sharedKey),
        checkInService.checkIn(propertyId, res.id, payload, standardActorContext, sharedKey),
      ]);

      // Both must successfully resolve with the same check-in record
      expect(result1.reservation.status).toBe(ReservationStatus.CHECKED_IN);
      expect(result2.reservation.status).toBe(ReservationStatus.CHECKED_IN);
      expect(result1.reservation.id).toBe(result2.reservation.id);
      expect(result1.reservation.checkInAt).toBe(result2.reservation.checkInAt);
    });
  });
});
