import { getPrismaClient, PrismaClient } from '@hms/database';
import { generateUuidV7 } from '@hms/shared';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../apps/api-core/src/common/database/prisma.service';
import { PropertyBusinessDateService } from '../../apps/api-core/src/modules/pms/common/services/property-business-date.service';
import { SystemClock } from '../../apps/api-core/src/modules/pms/common/services/system-clock.service';
import { AtsCalculatorService } from '../../apps/api-core/src/modules/pms/inventory/services/ats-calculator.service';
import { InventoryService } from '../../apps/api-core/src/modules/pms/inventory/services/inventory.service';
import { ReservationService } from '../../apps/api-core/src/modules/pms/reservations/services/reservation.service';
import { RoomStatusService } from '../../apps/api-core/src/modules/pms/room-operations/services/room-status.service';
import { RoomStatusReconciliationService } from '../../apps/api-core/src/modules/pms/room-operations/services/room-status-reconciliation.service';
import { RoomAssignmentService } from '../../apps/api-core/src/modules/pms/front-office/services/room-assignment.service';
import { CheckInService } from '../../apps/api-core/src/modules/pms/front-office/services/check-in.service';
import { FolioService } from '../../apps/api-core/src/modules/pms/finance/services/folio.service';
import { CheckoutService } from '../../apps/api-core/src/modules/pms/finance/services/checkout.service';
import {
  FolioStatus,
  HousekeepingStatus,
  PaymentMethod,
  PaymentStatus,
  PmsEventType,
  ReservationStatus,
  RoomOccupancyStatus,
  RoomServiceStatus,
  SecurityContext,
} from '@hms/api-contracts';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('W1-T08: Checkout & Folio Settlement Integration Tests', () => {
  jest.setTimeout(60000);

  let prisma: PrismaClient;
  let prismaService: PrismaService;
  let dateService: PropertyBusinessDateService;
  let atsCalculator: AtsCalculatorService;
  let inventoryService: InventoryService;
  let reservationService: ReservationService;
  let reconciliationService: RoomStatusReconciliationService;
  let roomStatusService: RoomStatusService;
  let assignmentService: RoomAssignmentService;
  let checkInService: CheckInService;
  let folioService: FolioService;
  let checkoutService: CheckoutService;

  const testSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  let hotelGroupId: string;
  let regionId: string;
  let countryId: string;
  let propertyId: string;
  let roomTypeId: string;
  let ratePlanId: string;
  let buildingId: string;
  let floorId: string;
  let roomId: string;
  const testUserId = generateUuidV7();

  const actorContext: SecurityContext = {
    userId: testUserId,
    sessionId: 'test-session',
    correlationId: 'test-corr',
    activeContext: {
      hotelGroupId: null,
      propertyId: '',
    },
    user: {
      id: testUserId,
      email: 'finance_cashier@example.com',
      firstName: 'Finance',
      lastName: 'Agent',
      status: 'ACTIVE',
    },
    isGlobalAdmin: false,
    roles: Object.freeze([]),
    permissions: new Set([
      'folio:view',
      'folio:post_charge',
      'folio:post_payment',
      'folio:rebate',
      'frontdesk:checkout',
      'front_office.room_assignment.manage',
      'front_office.checkin.execute',
    ]),
    scopes: Object.freeze([]),
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
    assignmentService = new RoomAssignmentService(
      prismaService,
      dateService,
      reconciliationService,
    );
    checkInService = new CheckInService(prismaService, dateService, roomStatusService);
    folioService = new FolioService(prismaService);
    checkoutService = new CheckoutService(prismaService, roomStatusService);

    // Organization Hierarchy
    hotelGroupId = generateUuidV7();
    await prisma.hotelGroup.create({
      data: { id: hotelGroupId, code: `GRP_T08_${testSuffix}`, name: 'Finance Group' },
    });

    regionId = generateUuidV7();
    await prisma.region.create({
      data: { id: regionId, hotelGroupId, code: `REG_T08_${testSuffix}`, name: 'Finance Region' },
    });

    countryId = generateUuidV7();
    await prisma.country.create({
      data: {
        id: countryId,
        regionId,
        code: `CO_${testSuffix}`.slice(0, 10),
        name: 'Finance Country',
      },
    });

    propertyId = generateUuidV7();
    await prisma.property.create({
      data: {
        id: propertyId,
        countryId,
        code: `PRP_T08_${testSuffix}`,
        name: 'Finance Property',
        timeZone: 'UTC',
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    (actorContext.activeContext as any).propertyId = propertyId;
    (actorContext.activeContext as any).hotelGroupId = hotelGroupId;

    buildingId = generateUuidV7();
    await prisma.building.create({
      data: {
        id: buildingId,
        propertyId,
        name: 'Main Tower',
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
        name: 'Level 1',
      },
    });

    roomTypeId = generateUuidV7();
    await prisma.roomType.create({
      data: {
        id: roomTypeId,
        propertyId,
        code: `DLX_${testSuffix}`.slice(0, 10),
        name: 'Deluxe King',
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
        roomNumber: '301',
        housekeepingStatus: HousekeepingStatus.INSPECTED,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        isActive: true,
        version: 0,
      },
    });

    ratePlanId = generateUuidV7();
    await prisma.ratePlan.create({
      data: {
        id: ratePlanId,
        propertyId,
        code: `BAR_${testSuffix}`.slice(0, 10),
        name: 'Best Available Rate',
        currency: 'USD',
        minStayDays: 1,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: new Date('2026-12-31T00:00:00.000Z'),
      },
    });

    await prisma.ratePlanRoomType.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        ratePlanId,
        roomTypeId,
        baseRateAmount: 200,
        extraAdultRate: 30,
        extraChildRate: 15,
        isActive: true,
      },
    });

    const invData = [];
    const baseDate = new Date();
    baseDate.setUTCHours(0, 0, 0, 0);
    for (let i = -1; i < 15; i++) {
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
      await prisma.payment.deleteMany({ where: { propertyId } });
      await prisma.folioTransaction.deleteMany({ where: { propertyId } });
      await prisma.folio.deleteMany({ where: { propertyId } });
      await prisma.reservationAssignmentLog.deleteMany({ where: { propertyId } });
      await prisma.roomStatusLog.deleteMany({ where: { propertyId } });
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
    await prisma.payment.deleteMany({ where: { propertyId } });
    await prisma.folioTransaction.deleteMany({ where: { propertyId } });
    await prisma.folio.deleteMany({ where: { propertyId } });
    await prisma.reservationAssignmentLog.deleteMany({ where: { propertyId } });
    await prisma.roomStatusLog.deleteMany({ where: { propertyId } });
    await prisma.reservationRateNight.deleteMany({ where: { propertyId } });
    await prisma.reservation.deleteMany({ where: { propertyId } });
    await prisma.guest.deleteMany({ where: { propertyId } });
    await prisma.dailyInventory.updateMany({
      where: { propertyId },
      data: { bookedCount: 0 },
    });
    await prisma.room.updateMany({
      where: { id: roomId },
      data: {
        housekeepingStatus: HousekeepingStatus.INSPECTED,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
      },
    });
  });

  // Helper to create and check in a reservation for arrival today
  async function createAndCheckInReservation(): Promise<string> {
    const today = dateService.getCurrentBusinessDate('UTC');
    const arrStr = today.toISOString().slice(0, 10);
    const depDate = new Date(today);
    depDate.setUTCDate(depDate.getUTCDate() + 2);
    const depStr = depDate.toISOString().slice(0, 10);

    const res = await reservationService.create(propertyId, {
      roomTypeId,
      ratePlanId,
      arrivalDate: arrStr,
      departureDate: depStr,
      adultsCount: 2,
      childrenCount: 0,
      guest: {
        firstName: 'Alice',
        lastName: 'Smith',
        email: `alice_${generateUuidV7().slice(0, 8)}@example.com`,
      },
    });

    await assignmentService.assignRoom(propertyId, res.id, { roomId }, actorContext);
    await checkInService.checkIn(
      propertyId,
      res.id,
      { identityVerified: true, registrationCardSigned: true },
      actorContext,
      `ci-${generateUuidV7()}`,
    );

    return res.id;
  }

  describe('1. Folio Creation & Idempotency', () => {
    it('creates a new folio with mandatory idempotency key and rejects missing key', async () => {
      const resId = await createAndCheckInReservation();
      const idempKey = `folio-create-${generateUuidV7()}`;

      // Rejects missing key
      await expect(
        folioService.createFolio(propertyId, { reservationId: resId }, actorContext, ''),
      ).rejects.toThrow(BadRequestException);

      // Successfully creates folio
      const folio = await folioService.createFolio(
        propertyId,
        { reservationId: resId },
        actorContext,
        idempKey,
      );

      expect(folio).toBeDefined();
      expect(folio.reservationId).toBe(resId);
      expect(folio.status).toBe(FolioStatus.OPEN);
      expect(folio.balance).toBe('0.0000');
      expect(folio.currency).toBe('USD');

      // Idempotent retry returns same folio without creating duplicate
      const retry = await folioService.createFolio(
        propertyId,
        { reservationId: resId },
        actorContext,
        idempKey,
      );
      expect(retry.id).toBe(folio.id);

      const count = await prisma.folio.count({ where: { propertyId, reservationId: resId } });
      expect(count).toBe(1);
    });
  });

  describe('2. Charge Posting & Balance Arithmetic', () => {
    it('posts charges, verifies balance += amount (NOT amount + taxAmount), and records outbox event', async () => {
      const resId = await createAndCheckInReservation();
      const folio = await folioService.createFolio(
        propertyId,
        { reservationId: resId },
        actorContext,
        `folio-key-${generateUuidV7()}`,
      );

      // Post Room Charge: $200 (incl $20 tax)
      const charge1Key = `charge-key-1-${generateUuidV7()}`;
      const charge1Payload = {
        transactionCode: 'ROOM_CHARGE',
        description: 'Room Rate Night 1',
        amount: '200.0000',
        taxAmount: '20.0000',
      };
      const charge1 = await folioService.postCharge(
        propertyId,
        folio.id,
        charge1Payload,
        actorContext,
        charge1Key,
      );

      expect(charge1.amount).toBe('200.0000');

      // Idempotent retry returns original charge
      const retryCharge = await folioService.postCharge(
        propertyId,
        folio.id,
        charge1Payload,
        actorContext,
        charge1Key,
      );
      expect(retryCharge.id).toBe(charge1.id);

      // Charge payload mismatch with same key throws 409 Conflict
      await expect(
        folioService.postCharge(
          propertyId,
          folio.id,
          { ...charge1Payload, description: 'Tampered Description' },
          actorContext,
          charge1Key,
        ),
      ).rejects.toThrow(ConflictException);

      let updatedFolio = await folioService.findById(propertyId, folio.id);
      // Verify: balance is 200.0000, NOT 220.0000!
      expect(updatedFolio.balance).toBe('200.0000');

      // Post Mini-Bar: $15 (incl $1.50 tax)
      await folioService.postCharge(
        propertyId,
        folio.id,
        {
          transactionCode: 'MINIBAR',
          description: 'Beverages',
          amount: '15.0000',
          taxAmount: '1.5000',
        },
        actorContext,
        `charge-key-2-${generateUuidV7()}`,
      );

      updatedFolio = await folioService.findById(propertyId, folio.id);
      expect(updatedFolio.balance).toBe('215.0000');

      // Post Rebate Credit: -$10 with reasonCode
      await folioService.postCharge(
        propertyId,
        folio.id,
        {
          transactionCode: 'ALLOWANCE',
          description: 'Service apology',
          amount: '-10.0000',
          reasonCode: 'SERVICE_RECOVERY',
        },
        actorContext,
        `charge-key-3-${generateUuidV7()}`,
      );

      updatedFolio = await folioService.findById(propertyId, folio.id);
      expect(updatedFolio.balance).toBe('205.0000');

      // Verify Outbox Event created
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          propertyId,
          type: PmsEventType.CHARGE_POSTED_TO_FOLIO,
          subject: folio.id,
        },
      });
      expect(outbox).toBeDefined();
    });
  });

  describe('3. Payment Recording & Idempotency', () => {
    it('records payment against folio: balance decreases, currency derived from folio', async () => {
      const resId = await createAndCheckInReservation();
      const folio = await folioService.createFolio(
        propertyId,
        { reservationId: resId },
        actorContext,
        `folio-key-${generateUuidV7()}`,
      );

      await folioService.postCharge(
        propertyId,
        folio.id,
        {
          transactionCode: 'ROOM_CHARGE',
          description: 'Room Charge',
          amount: '205.0000',
        },
        actorContext,
        `charge-key-${generateUuidV7()}`,
      );

      const payKey = `pay-key-${generateUuidV7()}`;
      const payment = await folioService.recordPayment(
        propertyId,
        folio.id,
        {
          amount: '205.0000',
          paymentMethod: PaymentMethod.CASH,
          referenceNumber: 'CASH-REC-101',
        },
        actorContext,
        payKey,
      );

      expect(payment.amount).toBe('205.0000');
      expect(payment.currency).toBe('USD');
      expect(payment.status).toBe(PaymentStatus.COMPLETED);

      const settledFolio = await folioService.findById(propertyId, folio.id);
      expect(settledFolio.balance).toBe('0.0000');

      // Idempotent retry returns original payment
      const retryPay = await folioService.recordPayment(
        propertyId,
        folio.id,
        {
          amount: '205.0000',
          paymentMethod: PaymentMethod.CASH,
          referenceNumber: 'CASH-REC-101',
        },
        actorContext,
        payKey,
      );
      expect(retryPay.id).toBe(payment.id);

      // Payment payload mismatch with same key throws 409 Conflict
      await expect(
        folioService.recordPayment(
          propertyId,
          folio.id,
          {
            amount: '100.0000',
            paymentMethod: PaymentMethod.CREDIT_CARD,
          },
          actorContext,
          payKey,
        ),
      ).rejects.toThrow(ConflictException);

      // Verify PAYMENT_RECORDED event
      const payEvent = await prisma.outboxEvent.findFirst({
        where: {
          propertyId,
          type: PmsEventType.PAYMENT_RECORDED,
          subject: folio.id,
        },
      });
      expect(payEvent).toBeDefined();
    });
  });

  describe('4. Checkout Workflow & STRICT ZERO-BALANCE Policy', () => {
    it('rejects checkout when folio balance > 0 (unsettled debt)', async () => {
      const resId = await createAndCheckInReservation();
      const folio = await folioService.createFolio(
        propertyId,
        { reservationId: resId },
        actorContext,
        `folio-key-${generateUuidV7()}`,
      );

      await folioService.postCharge(
        propertyId,
        folio.id,
        {
          transactionCode: 'ROOM_CHARGE',
          description: 'Room Charge',
          amount: '100.0000',
        },
        actorContext,
        `charge-key-${generateUuidV7()}`,
      );

      await expect(
        checkoutService.checkout(propertyId, resId, actorContext, `co-key-${generateUuidV7()}`),
      ).rejects.toThrow(ConflictException);

      // Verify reservation remains CHECKED_IN and room remains OCCUPIED
      const resAfter = await prisma.reservation.findUniqueOrThrow({ where: { id: resId } });
      expect(resAfter.status).toBe(ReservationStatus.CHECKED_IN);

      const roomAfter = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
      expect(roomAfter.occupancyStatus).toBe(RoomOccupancyStatus.OCCUPIED);
    });

    it('rejects checkout when folio balance < 0 (negative balance / guest credit deferred rule)', async () => {
      const resId = await createAndCheckInReservation();
      const folio = await folioService.createFolio(
        propertyId,
        { reservationId: resId },
        actorContext,
        `folio-key-${generateUuidV7()}`,
      );

      // Overpayment: charge $50, pay $100 -> balance is -50
      await folioService.postCharge(
        propertyId,
        folio.id,
        {
          transactionCode: 'MISC',
          description: 'Small Charge',
          amount: '50.0000',
        },
        actorContext,
        `charge-key-${generateUuidV7()}`,
      );

      await folioService.recordPayment(
        propertyId,
        folio.id,
        {
          amount: '100.0000',
          paymentMethod: PaymentMethod.CASH,
        },
        actorContext,
        `pay-key-${generateUuidV7()}`,
      );

      await expect(
        checkoutService.checkout(propertyId, resId, actorContext, `co-key-${generateUuidV7()}`),
      ).rejects.toThrow(ConflictException);

      const resAfter = await prisma.reservation.findUniqueOrThrow({ where: { id: resId } });
      expect(resAfter.status).toBe(ReservationStatus.CHECKED_IN);
    });

    it('successfully checks out when all folios have balance == 0.00: marks CHECKED_OUT, departs room to VACANT/DIRTY, closes folios', async () => {
      const resId = await createAndCheckInReservation();
      const folio = await folioService.createFolio(
        propertyId,
        { reservationId: resId },
        actorContext,
        `folio-key-${generateUuidV7()}`,
      );

      // Charge $205 and Pay $205 -> exactly 0.00
      await folioService.postCharge(
        propertyId,
        folio.id,
        {
          transactionCode: 'ROOM_CHARGE',
          description: 'Full Stay',
          amount: '205.0000',
        },
        actorContext,
        `charge-key-${generateUuidV7()}`,
      );

      await folioService.recordPayment(
        propertyId,
        folio.id,
        {
          amount: '205.0000',
          paymentMethod: PaymentMethod.CASH,
        },
        actorContext,
        `pay-key-${generateUuidV7()}`,
      );

      const coKey = `co-key-${generateUuidV7()}`;
      const checkoutRes = await checkoutService.checkout(propertyId, resId, actorContext, coKey);

      expect(checkoutRes).toBeDefined();
      expect(checkoutRes.reservation.status).toBe(ReservationStatus.CHECKED_OUT);
      expect(checkoutRes.room.occupancyStatus).toBe(RoomOccupancyStatus.VACANT);
      expect(checkoutRes.room.housekeepingStatus).toBe(HousekeepingStatus.DIRTY);

      // Verify Database state
      const dbRes = await prisma.reservation.findUniqueOrThrow({ where: { id: resId } });
      expect(dbRes.status).toBe(ReservationStatus.CHECKED_OUT);
      expect(dbRes.checkOutAt).toBeDefined();
      expect(dbRes.checkedOutBy).toBe(testUserId);
      expect(dbRes.checkOutIdempotencyKey).toBe(coKey);

      const dbRoom = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
      expect(dbRoom.occupancyStatus).toBe(RoomOccupancyStatus.VACANT);
      expect(dbRoom.housekeepingStatus).toBe(HousekeepingStatus.DIRTY);

      const dbFolio = await prisma.folio.findUniqueOrThrow({ where: { id: folio.id } });
      expect(dbFolio.status).toBe(FolioStatus.CLOSED);
      expect(dbFolio.closedAt).toBeDefined();

      // Verify Outbox Events
      const guestOutEvent = await prisma.outboxEvent.findFirst({
        where: {
          propertyId,
          type: PmsEventType.GUEST_CHECKED_OUT,
          subject: resId,
        },
      });
      expect(guestOutEvent).toBeDefined();

      const folioClosedEvent = await prisma.outboxEvent.findFirst({
        where: {
          propertyId,
          type: PmsEventType.FOLIO_CLOSED,
          subject: folio.id,
        },
      });
      expect(folioClosedEvent).toBeDefined();

      const roomOccEvent = await prisma.outboxEvent.findFirst({
        where: {
          propertyId,
          type: PmsEventType.ROOM_OCCUPANCY_CHANGED,
          subject: roomId,
        },
      });
      expect(roomOccEvent).toBeDefined();

      // Idempotent retry returns original result
      const retryCo = await checkoutService.checkout(propertyId, resId, actorContext, coKey);
      expect(retryCo.reservation.id).toBe(resId);
      expect(retryCo.reservation.status).toBe(ReservationStatus.CHECKED_OUT);
    });
  });

  describe('5. Concurrency Race Conditions & Explicit OCC', () => {
    it('concurrent checkout vs charge race: if folio is modified between balance read and closure, checkout fails with 409 OCC_CONFLICT', async () => {
      const resId = await createAndCheckInReservation();
      const folio = await folioService.createFolio(
        propertyId,
        { reservationId: resId },
        actorContext,
        `folio-key-${generateUuidV7()}`,
      );

      // Charge $100 and Pay $100 -> exactly 0.00
      await folioService.postCharge(
        propertyId,
        folio.id,
        {
          transactionCode: 'ROOM_CHARGE',
          description: 'Stay',
          amount: '100.0000',
        },
        actorContext,
        `charge-key-${generateUuidV7()}`,
      );

      await folioService.recordPayment(
        propertyId,
        folio.id,
        {
          amount: '100.0000',
          paymentMethod: PaymentMethod.CASH,
        },
        actorContext,
        `pay-key-${generateUuidV7()}`,
      );

      // Simulate concurrent transaction bumping folio version immediately after balance check read but before closure
      const origFindMany = (prisma.folio.findMany as any).bind(prisma.folio);
      jest
        .spyOn(prisma.folio as any, 'findMany')
        .mockImplementationOnce(async (args: any): Promise<any> => {
          const res = await origFindMany(args);
          await prisma.folio.update({
            where: { id: folio.id },
            data: { version: { increment: 1 } },
          });
          return res;
        });

      await expect(
        checkoutService.checkout(propertyId, resId, actorContext, `co-race-${generateUuidV7()}`),
      ).rejects.toThrow(ConflictException);

      // Reservation must NOT have transitioned to CHECKED_OUT
      const res = await prisma.reservation.findUniqueOrThrow({ where: { id: resId } });
      expect(res.status).toBe(ReservationStatus.CHECKED_IN);

      // Room must remain OCCUPIED
      const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
      expect(room.occupancyStatus).toBe(RoomOccupancyStatus.OCCUPIED);
    });
  });

  describe('6. Property Isolation', () => {
    it('rejects cross-property folio access and checkout operations', async () => {
      const resId = await createAndCheckInReservation();
      const folio = await folioService.createFolio(
        propertyId,
        { reservationId: resId },
        actorContext,
        `folio-key-${generateUuidV7()}`,
      );

      const otherPropertyId = generateUuidV7();

      // Cross-property folio retrieval throws NotFoundException
      await expect(folioService.findById(otherPropertyId, folio.id)).rejects.toThrow(
        NotFoundException,
      );

      // Cross-property checkout throws NotFoundException
      await expect(
        checkoutService.checkout(
          otherPropertyId,
          resId,
          actorContext,
          `co-cross-${generateUuidV7()}`,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
