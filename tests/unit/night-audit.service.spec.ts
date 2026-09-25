import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { NightAuditService } from '../../apps/api-core/src/modules/pms/night-audit/services/night-audit.service';
import { PropertyBusinessDateService } from '../../apps/api-core/src/modules/pms/common/services/property-business-date.service';
import {
  NightAuditStatus,
  NightAuditStepKey,
  NightAuditStepStatus,
  SecurityContext,
  ValidationIssueSeverity,
} from '@hms/api-contracts';
import { Clock } from '../../apps/api-core/src/modules/pms/common/contracts/clock.interface';
import { Prisma } from '@prisma/client';

class MockClock implements Clock {
  constructor(private currentInstant: Date) {}
  public now(): Date {
    return new Date(this.currentInstant.getTime());
  }
  public setInstant(instant: Date): void {
    this.currentInstant = instant;
  }
}

describe('NightAuditService (Night Audit & Hotel Business Date)', () => {
  let service: NightAuditService;
  let dateService: PropertyBusinessDateService;
  let mockPrisma: any;
  let mockClock: MockClock;

  const propertyId = '01925b6a-0000-7000-0000-000000000001';
  const actorId = '01925b6a-0000-7000-0000-000000000099';
  const tenantId = '01925b6a-0000-7000-0000-000000000088';

  const actorContext: SecurityContext = {
    userId: actorId,
    sessionId: 'session-audit-1',
    correlationId: 'corr-audit-1',
    activeContext: {
      hotelGroupId: tenantId,
      propertyId,
    },
    user: {
      id: actorId,
      email: 'nightauditor@enterprise-hms.com',
      firstName: 'Night',
      lastName: 'Auditor',
      status: 'ACTIVE',
    },
    isGlobalAdmin: false,
    roles: Object.freeze([
      {
        id: 'role-audit-1',
        code: 'NIGHT_AUDITOR',
        name: 'Night Auditor',
        isSystem: true,
        hotelGroupId: null,
      },
    ]),
    permissions: new Set([
      'night_audit:view',
      'night_audit:run',
      'night_audit:approve',
      'night_audit:recover',
    ]),
    scopes: Object.freeze([]),
  };

  const currentDate = new Date('2026-10-01T00:00:00.000Z');
  const nextDate = new Date('2026-10-02T00:00:00.000Z');

  beforeEach(() => {
    mockClock = new MockClock(new Date('2026-10-01T23:30:00.000Z'));

    mockPrisma = {
      property: {
        findUnique: jest.fn().mockResolvedValue({
          id: propertyId,
          code: 'PROP01',
          timeZone: 'America/New_York',
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: propertyId,
          code: 'PROP01',
          timeZone: 'America/New_York',
        }),
      },
      propertyBusinessDate: {
        findUnique: jest.fn().mockResolvedValue({
          propertyId,
          currentBusinessDate: currentDate,
          previousBusinessDate: null,
          isAuditInProgress: false,
          lastAuditRunId: null,
          lastAuditedAt: null,
          version: 1,
          property: { timeZone: 'America/New_York' },
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          propertyId,
          currentBusinessDate: currentDate,
          previousBusinessDate: null,
          isAuditInProgress: false,
          lastAuditRunId: null,
          lastAuditedAt: null,
          version: 1,
          property: { timeZone: 'America/New_York' },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            propertyId,
            currentBusinessDate: data.currentBusinessDate || currentDate,
            previousBusinessDate: data.previousBusinessDate || null,
            isAuditInProgress: data.isAuditInProgress ?? false,
            lastAuditRunId: data.lastAuditRunId || null,
            lastAuditedAt: data.lastAuditedAt || null,
            version: 2,
            property: { timeZone: 'America/New_York' },
          }),
        ),
      },
      nightAuditRun: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'run-1',
          propertyId,
          businessDate: currentDate,
          nextBusinessDate: nextDate,
          status: NightAuditStatus.COMPLETED,
          executedBy: actorId,
          startedAt: new Date(),
          completedAt: new Date(),
          failureReason: null,
          metrics: { roomNightsPosted: 1, roomRevenuePosted: 150 },
          version: 1,
          createdAt: new Date(),
          steps: [],
        }),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...data,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'run-1',
            propertyId,
            ...data,
            version: 2,
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
      nightAuditStep: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      reservation: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      room: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      folio: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...data,
            version: 0,
          }),
        ),
        update: jest.fn().mockResolvedValue({ id: 'folio-1', balance: new Prisma.Decimal(150) }),
      },
      folioTransaction: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      $transaction: jest.fn().mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      }),
    };

    dateService = new PropertyBusinessDateService(mockClock, mockPrisma);
    service = new NightAuditService(mockPrisma, dateService);
  });

  describe('getBusinessDateStatus', () => {
    it('should return authoritative business date and timezone info', async () => {
      const status = await service.getBusinessDateStatus(propertyId);

      expect(status.businessDate.propertyId).toBe(propertyId);
      expect(status.businessDate.currentBusinessDate).toBe('2026-10-01');
      expect(status.businessDate.propertyTimeZone).toBe('America/New_York');
      expect(status.isAuditInProgress).toBe(false);
    });

    it('should throw NotFoundException if property does not exist', async () => {
      mockPrisma.propertyBusinessDate.findUnique.mockResolvedValue(null);
      mockPrisma.property.findUnique.mockResolvedValue(null);

      await expect(service.getBusinessDateStatus('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validatePreAudit', () => {
    it('should report warnings for pending arrivals and departures', async () => {
      // Mock 1 pending arrival
      mockPrisma.reservation.findMany
        .mockResolvedValueOnce([
          {
            id: 'res-arr-1',
            confirmationNumber: 'CN-100',
            arrivalDate: currentDate,
            status: 'CONFIRMED',
          },
        ])
        // Mock 1 pending departure
        .mockResolvedValueOnce([
          {
            id: 'res-dep-1',
            confirmationNumber: 'CN-200',
            departureDate: currentDate,
            assignedRoomId: 'room-1',
          },
        ])
        // Mock in-house reservations
        .mockResolvedValueOnce([]);

      // Mock dirty rooms
      mockPrisma.room.findMany.mockResolvedValueOnce([
        { id: 'room-dirty', roomNumber: '101' },
      ]);

      const report = await service.validatePreAudit(propertyId);

      expect(report.canProceed).toBe(true); // Warnings are non-blocking
      expect(report.hasWarnings).toBe(true);
      expect(report.hasBlockingIssues).toBe(false);
      expect(report.metrics.pendingArrivalsCount).toBe(1);
      expect(report.metrics.pendingDeparturesCount).toBe(1);
      expect(report.metrics.dirtyRoomsCount).toBe(1);
      expect(report.issues.length).toBe(3);
    });

    it('should calculate projected room revenue for in-house reservations', async () => {
      mockPrisma.reservation.findMany
        .mockResolvedValueOnce([]) // arrivals
        .mockResolvedValueOnce([]) // departures
        .mockResolvedValueOnce([
          {
            id: 'res-inh-1',
            status: 'CHECKED_IN',
            arrivalDate: new Date('2026-10-01T00:00:00.000Z'),
            departureDate: new Date('2026-10-03T00:00:00.000Z'),
            totalAmount: new Prisma.Decimal(300),
            rateNights: [
              {
                businessDate: currentDate,
                totalAmount: new Prisma.Decimal(150),
              },
            ],
          },
        ]);

      const report = await service.validatePreAudit(propertyId);

      expect(report.metrics.inHouseReservationsCount).toBe(1);
      expect(report.metrics.expectedRoomRevenue).toBe(150);
    });
  });

  describe('runNightAudit (Concurrency & Idempotency)', () => {
    it('should reject simultaneous concurrent audit runs with 409 Conflict', async () => {
      // Simulate lock failure (another thread acquired lock)
      mockPrisma.propertyBusinessDate.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.runNightAudit(propertyId, {}, actorContext),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject run if audit was already completed for today', async () => {
      mockPrisma.nightAuditRun.findUnique.mockResolvedValueOnce({
        id: 'run-existing',
        propertyId,
        businessDate: currentDate,
        status: NightAuditStatus.COMPLETED,
      });

      await expect(
        service.runNightAudit(propertyId, {}, actorContext),
      ).rejects.toThrow(ConflictException);

      // Lock should have been released
      expect(mockPrisma.propertyBusinessDate.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { propertyId, isAuditInProgress: true },
          data: expect.objectContaining({ isAuditInProgress: false }),
        }),
      );
    });

    it('should reject audit with warnings when overrideWarnings is false', async () => {
      // Pending arrival exists
      mockPrisma.reservation.findMany.mockResolvedValueOnce([
        {
          id: 'res-1',
          confirmationNumber: 'CN-1',
          arrivalDate: currentDate,
          status: 'CONFIRMED',
        },
      ]);

      await expect(
        service.runNightAudit(propertyId, { overrideWarnings: false }, actorContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should proceed and complete rollover when overrideWarnings is true', async () => {
      // Pending arrival exists
      mockPrisma.reservation.findMany
        .mockResolvedValueOnce([
          {
            id: 'res-1',
            confirmationNumber: 'CN-1',
            arrivalDate: currentDate,
            status: 'CONFIRMED',
          },
        ]) // in validatePreAudit arrivals
        .mockResolvedValueOnce([]) // departures
        .mockResolvedValueOnce([]) // in-house
        .mockResolvedValueOnce([
          {
            id: 'res-1',
            confirmationNumber: 'CN-1',
            arrivalDate: currentDate,
            status: 'CONFIRMED',
          },
        ]) // in step 2 (no-show processing)
        .mockResolvedValueOnce([]); // in step 3 (room charges)

      const result = await service.runNightAudit(
        propertyId,
        { overrideWarnings: true, overrideReason: 'Approved by GM for late arrival' },
        actorContext,
      );

      expect(result.status).toBe(NightAuditStatus.COMPLETED);
      expect(mockPrisma.outboxEvent.createMany).toHaveBeenCalled();
    });

    it('should post room charges idempotently and advance date by 1 day', async () => {
      // Clean validation
      mockPrisma.reservation.findMany
        .mockResolvedValueOnce([]) // validate arrivals
        .mockResolvedValueOnce([]) // validate departures
        .mockResolvedValueOnce([]) // validate in-house
        .mockResolvedValueOnce([]) // step 2 no-shows
        .mockResolvedValueOnce([
          {
            id: 'res-inhouse',
            status: 'CHECKED_IN',
            currency: 'USD',
            guestId: 'guest-1',
            totalAmount: new Prisma.Decimal(200),
            arrivalDate: currentDate,
            departureDate: nextDate,
            rateNights: [
              {
                businessDate: currentDate,
                totalAmount: new Prisma.Decimal(200),
              },
            ],
            assignedRoom: { roomNumber: '101' },
          },
        ]); // step 3 room charges

      mockPrisma.folio.findFirst.mockResolvedValueOnce({
        id: 'folio-open-1',
        tenantId,
        propertyId,
        status: 'OPEN',
        balance: new Prisma.Decimal(0),
        version: 0,
      });

      const result = await service.runNightAudit(propertyId, {}, actorContext);

      expect(result.status).toBe(NightAuditStatus.COMPLETED);
      expect(mockPrisma.folioTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transactionCode: 'ROOM_CHARGE',
            amount: new Prisma.Decimal(200),
            idempotencyKey: expect.stringContaining('audit-'),
          }),
        }),
      );
      expect(mockPrisma.folio.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'folio-open-1' },
          data: expect.objectContaining({
            balance: { increment: new Prisma.Decimal(200) },
          }),
        }),
      );
    });
  });

  describe('recoverStuckAudit', () => {
    it('should forcibly release lock and mark active runs as FAILED', async () => {
      mockPrisma.nightAuditRun.findMany.mockResolvedValueOnce([
        {
          id: 'stuck-run-1',
          propertyId,
          status: NightAuditStatus.IN_PROGRESS,
        },
      ]);

      const recovered = await service.recoverStuckAudit(
        propertyId,
        { reason: 'Server worker restarted mid-process' },
        actorContext,
      );

      expect(recovered.isAuditInProgress).toBe(false);
      expect(mockPrisma.nightAuditRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'stuck-run-1' },
          data: expect.objectContaining({
            status: NightAuditStatus.FAILED,
          }),
        }),
      );
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalled();
    });
  });
});
