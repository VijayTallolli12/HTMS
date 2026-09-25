import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventsBookingService } from '../../apps/api-core/src/modules/events/services/events-booking.service';
import { EventsCatalogService } from '../../apps/api-core/src/modules/events/services/events-catalog.service';
import { SecurityContext, EventBookingStatus } from '@hms/api-contracts';

describe('Events & Banquets Operations Service Suite', () => {
  const propertyId = '01a00000-0000-7000-0000-000000000001';
  const venueId = '01a00000-0000-7000-0000-000000000101';
  const packageId = '01a00000-0000-7000-0000-000000000201';
  const resourceId = '01a00000-0000-7000-0000-000000000301';
  const bookingId = '01a00000-0000-7000-0000-000000000401';
  const reservationId = '01a00000-0000-7000-0000-000000000501';
  const folioId = '01a00000-0000-7000-0000-000000000601';
  const actorId = '01a00000-0000-7000-0000-000000000999';

  const mockActor: SecurityContext = {
    userId: actorId,
    sessionId: 'session-evt-1',
    correlationId: 'corr-evt-1',
    activeContext: {
      hotelGroupId: '01a00000-0000-7000-0000-000000000000',
      propertyId,
    },
    user: {
      id: actorId,
      email: 'events@example.com',
      firstName: 'Banquet',
      lastName: 'Director',
      status: 'ACTIVE',
    },
    isGlobalAdmin: false,
    roles: Object.freeze([]),
    permissions: new Set([
      'events.venue.view',
      'events.venue.manage',
      'events.package.view',
      'events.package.manage',
      'events.booking.view',
      'events.booking.create',
      'events.booking.manage',
      'events.booking.confirm',
      'events.booking.complete',
    ]),
    scopes: Object.freeze([]),
  };

  let bookingService: EventsBookingService;
  let catalogService: EventsCatalogService;
  let mockPrisma: any;
  let mockFolioService: any;

  beforeEach(() => {
    mockFolioService = {
      postCharge: jest.fn().mockResolvedValue({
        id: 'tx-banquet-999',
        folioId,
        transactionCode: 'BANQUET',
        amount: '1200000.00',
      }),
    };

    mockPrisma = {
      eventVenue: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: venueId,
          propertyId,
          code: 'V-BALLROOM',
          name: 'Grand Ballroom',
          venueType: 'BALLROOM',
          capacity: 300,
          location: 'Main Tower Level 2',
          isActive: true,
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
      eventPackage: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: packageId,
          propertyId,
          code: 'PKG-CONF',
          name: 'Corporate Conference',
          description: 'Full-day catering package',
          pricePerGuest: new Prisma.Decimal(8000),
          currency: 'JPY',
          minGuests: 20,
          isActive: true,
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
      eventResource: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: resourceId,
          propertyId,
          name: 'Projectors',
          resourceType: 'AUDIO_VISUAL',
          totalQuantity: 10,
          isActive: true,
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
      eventBooking: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      eventBookingResource: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'alloc-1' }),
      },
      room: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'room-104',
          propertyId,
          roomNumber: '104',
        }),
      },
      reservation: {
        findFirst: jest.fn().mockResolvedValue({
          id: reservationId,
          propertyId,
          confirmationNumber: 'RES-104',
          status: 'CHECKED_IN',
          guest: {
            id: 'guest-1',
            firstName: 'Daniel',
            lastName: 'Craig',
          },
          assignedRoom: {
            id: 'room-104',
            roomNumber: '104',
          },
        }),
      },
      folio: {
        findFirst: jest.fn().mockResolvedValue({
          id: folioId,
          propertyId,
          reservationId,
          status: 'OPEN',
          folioNumber: 'FOL-104',
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    catalogService = new EventsCatalogService(mockPrisma);
    bookingService = new EventsBookingService(mockPrisma, mockFolioService);
  });

  describe('Venue & Package Catalog Management', () => {
    it('should list banquet venues for a property', async () => {
      mockPrisma.eventVenue.findMany.mockResolvedValue([
        {
          id: venueId,
          propertyId,
          code: 'V-BALLROOM',
          name: 'Grand Ballroom',
          venueType: 'BALLROOM',
          capacity: 300,
          isActive: true,
        },
      ]);

      const venues = await catalogService.getVenues(propertyId);
      expect(venues.length).toBe(1);
      expect(venues[0].name).toBe('Grand Ballroom');
      expect(venues[0].capacity).toBe(300);
    });

    it('should prevent duplicate venue codes within the same property', async () => {
      mockPrisma.eventVenue.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        catalogService.createVenue(propertyId, {
          code: 'V-BALLROOM',
          name: 'Duplicate Ballroom',
          capacity: 200,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a new event package', async () => {
      mockPrisma.eventPackage.findFirst.mockResolvedValue(null);
      mockPrisma.eventPackage.create.mockResolvedValue({
        id: packageId,
        propertyId,
        code: 'PKG-GALA',
        name: 'Gala Dinner',
        pricePerGuest: new Prisma.Decimal(12000),
        currency: 'JPY',
        minGuests: 30,
        isActive: true,
      });

      const pkg = await catalogService.createPackage(propertyId, {
        code: 'PKG-GALA',
        name: 'Gala Dinner',
        pricePerGuest: 12000,
        minGuests: 30,
      });

      expect(pkg.name).toBe('Gala Dinner');
      expect(pkg.pricePerGuest).toBe('12000.00');
    });
  });

  describe('Booking Creation & Capacity Validation', () => {
    const baseStart = new Date('2026-10-01T09:00:00.000Z');
    const baseEnd = new Date('2026-10-01T17:00:00.000Z');

    it('should create an event booking in DRAFT status', async () => {
      mockPrisma.eventBooking.create.mockResolvedValue({
        id: bookingId,
        propertyId,
        bookingNumber: 'EVT-20261001-0001',
        venueId,
        packageId,
        hostName: 'Daniel Craig',
        eventName: 'Global Tech Summit 2026',
        eventType: 'CONFERENCE',
        startTime: baseStart,
        endTime: baseEnd,
        expectedGuests: 150,
        estimatedAmount: new Prisma.Decimal(1200000),
        currency: 'JPY',
        status: 'DRAFT',
        version: 1,
        venue: { name: 'Grand Ballroom', capacity: 300 },
        package: { name: 'Corporate Conference' },
        resourceAllocations: [],
      });

      const booking = await bookingService.createBooking(
        propertyId,
        {
          venueId,
          packageId,
          hostName: 'Daniel Craig',
          eventName: 'Global Tech Summit 2026',
          startTime: baseStart.toISOString(),
          endTime: baseEnd.toISOString(),
          expectedGuests: 150,
        },
        actorId,
      );

      expect(booking).toBeDefined();
      expect(booking.bookingNumber).toBe('EVT-20261001-0001');
      expect(booking.status).toBe('DRAFT');
      expect(booking.estimatedAmount).toBe('1200000.00');
    });

    it('should reject booking when expected guests exceed venue capacity', async () => {
      await expect(
        bookingService.createBooking(
          propertyId,
          {
            venueId,
            hostName: 'Over Capacity Host',
            eventName: 'Too Big Event',
            startTime: baseStart.toISOString(),
            endTime: baseEnd.toISOString(),
            expectedGuests: 500, // Venue capacity is 300
          },
          actorId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject booking when start time is after end time', async () => {
      await expect(
        bookingService.createBooking(
          propertyId,
          {
            venueId,
            hostName: 'Invalid Times',
            eventName: 'Reversed Times Event',
            startTime: baseEnd.toISOString(),
            endTime: baseStart.toISOString(),
            expectedGuests: 50,
          },
          actorId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Venue Collision Prevention', () => {
    const baseStart = new Date('2026-10-01T09:00:00.000Z');
    const baseEnd = new Date('2026-10-01T17:00:00.000Z');

    it('should reject confirming booking when venue is already booked for overlapping schedule', async () => {
      const draftBooking = {
        id: bookingId,
        propertyId,
        venueId,
        status: 'DRAFT',
        startTime: baseStart,
        endTime: baseEnd,
        venue: { name: 'Grand Ballroom' },
      };

      mockPrisma.eventBooking.findFirst
        .mockResolvedValueOnce(draftBooking) // find booking
        .mockResolvedValueOnce({
          // conflict check
          id: 'existing-confirmed-booking',
          venueId,
          bookingNumber: 'EVT-20261001-9999',
          status: 'CONFIRMED',
          startTime: baseStart,
          endTime: baseEnd,
          venue: { name: 'Grand Ballroom' },
        });

      await expect(
        bookingService.updateBookingStatus(
          propertyId,
          bookingId,
          { status: 'CONFIRMED' },
          actorId,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Lifecycle Status Transitions', () => {
    const baseStart = new Date('2026-10-01T09:00:00.000Z');
    const baseEnd = new Date('2026-10-01T17:00:00.000Z');

    it('should transition DRAFT -> TENTATIVE -> CONFIRMED -> IN_PROGRESS', async () => {
      const booking = {
        id: bookingId,
        propertyId,
        venueId,
        status: 'DRAFT',
        startTime: baseStart,
        endTime: baseEnd,
        venue: { name: 'Grand Ballroom' },
        package: null,
        resourceAllocations: [],
      };

      // DRAFT -> TENTATIVE
      mockPrisma.eventBooking.findFirst.mockResolvedValue(booking);
      mockPrisma.eventBooking.update.mockResolvedValue({ ...booking, status: 'TENTATIVE' });
      const tentative = await bookingService.updateBookingStatus(
        propertyId,
        bookingId,
        { status: 'TENTATIVE' },
        actorId,
      );
      expect(tentative.status).toBe('TENTATIVE');

      // TENTATIVE -> CONFIRMED (no conflict)
      mockPrisma.eventBooking.findFirst
        .mockResolvedValueOnce({ ...booking, status: 'TENTATIVE' })
        .mockResolvedValueOnce(null); // conflict check returns null
      mockPrisma.eventBooking.update.mockResolvedValue({ ...booking, status: 'CONFIRMED' });
      const confirmed = await bookingService.updateBookingStatus(
        propertyId,
        bookingId,
        { status: 'CONFIRMED' },
        actorId,
      );
      expect(confirmed.status).toBe('CONFIRMED');

      // CONFIRMED -> IN_PROGRESS (no conflict)
      mockPrisma.eventBooking.findFirst
        .mockResolvedValueOnce({ ...booking, status: 'CONFIRMED' })
        .mockResolvedValueOnce(null);
      mockPrisma.eventBooking.update.mockResolvedValue({ ...booking, status: 'IN_PROGRESS' });
      const inProgress = await bookingService.updateBookingStatus(
        propertyId,
        bookingId,
        { status: 'IN_PROGRESS' },
        actorId,
      );
      expect(inProgress.status).toBe('IN_PROGRESS');
    });

    it('should reject invalid transition (e.g. DRAFT to COMPLETED)', async () => {
      const booking = {
        id: bookingId,
        propertyId,
        status: 'DRAFT',
      };
      mockPrisma.eventBooking.findFirst.mockResolvedValue(booking);

      await expect(
        bookingService.updateBookingStatus(
          propertyId,
          bookingId,
          { status: 'COMPLETED' },
          actorId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Resource Allocation', () => {
    it('should allocate equipment within available inventory limits', async () => {
      const booking = {
        id: bookingId,
        propertyId,
        status: 'CONFIRMED',
      };
      mockPrisma.eventBooking.findFirst.mockResolvedValue(booking);

      const updated = await bookingService.allocateResources(
        propertyId,
        bookingId,
        {
          allocations: [
            { resourceId, quantity: 4, notes: 'Stage left and right' },
          ],
        },
        actorId,
      );

      expect(mockPrisma.eventBookingResource.deleteMany).toHaveBeenCalledWith({
        where: { bookingId },
      });
      expect(mockPrisma.eventBookingResource.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingId,
            resourceId,
            quantity: 4,
          }),
        }),
      );
    });

    it('should reject allocation when requested quantity exceeds total inventory', async () => {
      const booking = {
        id: bookingId,
        propertyId,
        status: 'CONFIRMED',
      };
      mockPrisma.eventBooking.findFirst.mockResolvedValue(booking);

      await expect(
        bookingService.allocateResources(
          propertyId,
          bookingId,
          {
            allocations: [
              { resourceId, quantity: 20 }, // Total inventory is 10
            ],
          },
          actorId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Event Completion & Cashiering Folio Billing', () => {
    it('should complete event and post charge to guest folio with BANQUET code', async () => {
      const inProgressBooking = {
        id: bookingId,
        propertyId,
        bookingNumber: 'EVT-20261001-1001',
        eventName: 'Tech Summit',
        status: 'IN_PROGRESS',
        roomNumber: '104',
        hostName: 'Daniel Craig',
        estimatedAmount: new Prisma.Decimal(1200000),
        currency: 'JPY',
        venue: { name: 'Grand Ballroom' },
        package: { name: 'Corporate Conference' },
      };

      mockPrisma.eventBooking.findFirst.mockResolvedValue(inProgressBooking);
      mockPrisma.eventBooking.update.mockResolvedValue({
        ...inProgressBooking,
        status: 'COMPLETED',
        settlementType: 'ROOM_CHARGE',
        paymentMethod: 'ROOM_CHARGE',
        folioId,
        folioTransactionId: 'tx-banquet-999',
        reservationId,
      });

      const completed = await bookingService.completeBooking(
        propertyId,
        bookingId,
        {
          settlementType: 'ROOM_CHARGE',
          roomNumber: '104',
        },
        mockActor,
      );

      expect(completed.status).toBe('COMPLETED');
      expect(completed.settlementType).toBe('ROOM_CHARGE');
      expect(mockFolioService.postCharge).toHaveBeenCalledWith(
        propertyId,
        folioId,
        expect.objectContaining({
          transactionCode: 'BANQUET',
          amount: '1200000.00',
        }),
        mockActor,
        `event_booking_complete_${bookingId}`,
      );
    });

    it('should complete event with DIRECT_PAY without folio posting', async () => {
      const inProgressBooking = {
        id: bookingId,
        propertyId,
        bookingNumber: 'EVT-20261001-1002',
        eventName: 'Board Meeting',
        status: 'IN_PROGRESS',
        estimatedAmount: new Prisma.Decimal(75000),
        currency: 'JPY',
        venue: { name: 'Executive Meeting Room' },
      };

      mockPrisma.eventBooking.findFirst.mockResolvedValue(inProgressBooking);
      mockPrisma.eventBooking.update.mockResolvedValue({
        ...inProgressBooking,
        status: 'COMPLETED',
        settlementType: 'DIRECT_PAY',
        paymentMethod: 'CREDIT_CARD',
      });

      const completed = await bookingService.completeBooking(
        propertyId,
        bookingId,
        {
          settlementType: 'DIRECT_PAY',
          paymentMethod: 'CREDIT_CARD',
        },
        mockActor,
      );

      expect(completed.status).toBe('COMPLETED');
      expect(completed.settlementType).toBe('DIRECT_PAY');
      expect(mockFolioService.postCharge).not.toHaveBeenCalled();
    });

    it('should reject completing a CANCELLED event booking', async () => {
      mockPrisma.eventBooking.findFirst.mockResolvedValue({
        id: bookingId,
        propertyId,
        status: 'CANCELLED',
      });

      await expect(
        bookingService.completeBooking(
          propertyId,
          bookingId,
          { settlementType: 'DIRECT_PAY' },
          mockActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

