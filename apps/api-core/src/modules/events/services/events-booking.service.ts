import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';
import { Prisma } from '@prisma/client';
import {
  EventBookingDto,
  EventBookingStatus,
  SecurityContext,
} from '@hms/api-contracts';
import { FolioService } from '../../pms/finance/services/folio.service';
import {
  CreateEventBookingDto,
  UpdateEventBookingStatusDto,
  CompleteEventBookingDto,
  QueryEventBookingsDto,
  AllocateResourcesDto,
} from '../dto/events.dto';

@Injectable()
export class EventsBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly folioService: FolioService,
  ) {}

  // ==========================================
  // CREATE BOOKING
  // ==========================================
  async createBooking(
    propertyId: string,
    dto: CreateEventBookingDto,
    userId: string,
  ): Promise<EventBookingDto> {
    const venue = await this.prisma.eventVenue.findFirst({
      where: { id: dto.venueId, propertyId, isActive: true },
    });
    if (!venue) {
      throw new NotFoundException(`Active Event Venue '${dto.venueId}' not found`);
    }

    if (dto.expectedGuests > venue.capacity) {
      throw new BadRequestException(
        `Expected guests (${dto.expectedGuests}) exceeds maximum venue capacity (${venue.capacity}) for ${venue.name}`,
      );
    }

    let pkg: any = null;
    if (dto.packageId) {
      pkg = await this.prisma.eventPackage.findFirst({
        where: { id: dto.packageId, propertyId, isActive: true },
      });
      if (!pkg) {
        throw new NotFoundException(`Active Event Package '${dto.packageId}' not found`);
      }
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new BadRequestException('Invalid start or end time provided');
    }
    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Calculate or parse estimated amount
    let estimatedAmount: Prisma.Decimal;
    if (dto.estimatedAmount !== undefined && dto.estimatedAmount !== null) {
      estimatedAmount = new Prisma.Decimal(dto.estimatedAmount);
    } else if (pkg) {
      estimatedAmount = pkg.pricePerGuest.mul(dto.expectedGuests);
    } else {
      estimatedAmount = new Prisma.Decimal(0);
    }

    let resolvedRoomNumber: string | null = dto.roomNumber?.trim() || null;
    let resolvedGuestName: string | null = dto.hostName.trim();
    let resolvedReservationId: string | null = dto.reservationId || null;

    if (dto.roomNumber && !dto.reservationId) {
      const hotelRoom = await this.prisma.room.findFirst({
        where: { propertyId, roomNumber: dto.roomNumber.trim() },
      });
      if (hotelRoom) {
        const checkedIn = await this.prisma.reservation.findFirst({
          where: {
            propertyId,
            assignedRoomId: hotelRoom.id,
            status: 'CHECKED_IN',
          },
          include: { guest: true },
        });
        if (checkedIn) {
          resolvedReservationId = checkedIn.id;
          resolvedGuestName = checkedIn.guest
            ? `${checkedIn.guest.firstName} ${checkedIn.guest.lastName}`
            : resolvedGuestName;
        }
      }
    }

    const seq = Math.floor(1000 + Math.random() * 9000);
    const datePrefix = startTime.toISOString().slice(0, 10).replace(/-/g, '');
    const bookingNumber = `EVT-${datePrefix}-${seq}`;

    const created = await this.prisma.eventBooking.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        bookingNumber,
        venueId: venue.id,
        packageId: pkg?.id || null,
        hostName: resolvedGuestName,
        hostEmail: dto.hostEmail?.trim() || null,
        hostPhone: dto.hostPhone?.trim() || null,
        eventName: dto.eventName.trim(),
        eventType: dto.eventType || 'CONFERENCE',
        startTime,
        endTime,
        expectedGuests: dto.expectedGuests,
        estimatedAmount,
        currency: pkg?.currency || 'JPY',
        status: 'DRAFT',
        notes: dto.notes?.trim() || null,
        roomNumber: resolvedRoomNumber,
        reservationId: resolvedReservationId,
        version: 1,
      },
      include: {
        venue: true,
        package: true,
        resourceAllocations: {
          include: { resource: true },
        },
      },
    });

    return this.mapToDto(created);
  }

  // ==========================================
  // QUERY BOOKINGS
  // ==========================================
  async getBookings(
    propertyId: string,
    query: QueryEventBookingsDto,
  ): Promise<EventBookingDto[]> {
    const where: any = { propertyId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.venueId) {
      where.venueId = query.venueId;
    }

    if (query.date) {
      const dayStart = new Date(`${query.date}T00:00:00.000Z`);
      const dayEnd = new Date(`${query.date}T23:59:59.999Z`);
      where.startTime = {
        gte: dayStart,
        lte: dayEnd,
      };
    } else if (query.startDate && query.endDate) {
      where.startTime = {
        gte: new Date(query.startDate),
        lte: new Date(query.endDate),
      };
    }

    const bookings = await this.prisma.eventBooking.findMany({
      where,
      include: {
        venue: true,
        package: true,
        resourceAllocations: {
          include: { resource: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return bookings.map(this.mapToDto);
  }

  async getBooking(
    propertyId: string,
    bookingId: string,
  ): Promise<EventBookingDto> {
    const booking = await this.prisma.eventBooking.findFirst({
      where: { id: bookingId, propertyId },
      include: {
        venue: true,
        package: true,
        resourceAllocations: {
          include: { resource: true },
        },
      },
    });
    if (!booking) {
      throw new NotFoundException(`Event Booking '${bookingId}' not found`);
    }

    return this.mapToDto(booking);
  }

  // ==========================================
  // STATUS TRANSITIONS & CONFLICT CHECK
  // ==========================================
  async updateBookingStatus(
    propertyId: string,
    bookingId: string,
    dto: UpdateEventBookingStatusDto,
    userId: string,
  ): Promise<EventBookingDto> {
    const booking = await this.prisma.eventBooking.findFirst({
      where: { id: bookingId, propertyId },
      include: { venue: true, package: true },
    });
    if (!booking) {
      throw new NotFoundException(`Event Booking '${bookingId}' not found`);
    }

    const currentStatus = booking.status;
    const targetStatus = dto.status;

    const validTransitions: Record<string, string[]> = {
      DRAFT: ['TENTATIVE', 'CONFIRMED', 'CANCELLED'],
      TENTATIVE: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed: [${allowed.join(', ')}]`,
      );
    }

    // Overlap collision check when confirming or starting event
    if (targetStatus === 'CONFIRMED' || targetStatus === 'IN_PROGRESS') {
      await this.checkVenueScheduleConflicts(
        propertyId,
        booking.venueId,
        booking.startTime,
        booking.endTime,
        booking.id,
      );
    }

    const updated = await this.prisma.eventBooking.update({
      where: { id: bookingId },
      data: {
        status: targetStatus,
        version: { increment: 1 },
      },
      include: {
        venue: true,
        package: true,
        resourceAllocations: {
          include: { resource: true },
        },
      },
    });

    return this.mapToDto(updated);
  }

  // ==========================================
  // RESOURCE ALLOCATION
  // ==========================================
  async allocateResources(
    propertyId: string,
    bookingId: string,
    dto: AllocateResourcesDto,
    userId: string,
  ): Promise<EventBookingDto> {
    const booking = await this.prisma.eventBooking.findFirst({
      where: { id: bookingId, propertyId },
    });
    if (!booking) {
      throw new NotFoundException(`Event Booking '${bookingId}' not found`);
    }

    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot alter resource allocations for a ${booking.status} booking`);
    }

    // Validate resource limits
    for (const alloc of dto.allocations) {
      const resource = await this.prisma.eventResource.findFirst({
        where: { id: alloc.resourceId, propertyId, isActive: true },
      });
      if (!resource) {
        throw new NotFoundException(`Active Event Resource '${alloc.resourceId}' not found`);
      }
      if (alloc.quantity > resource.totalQuantity) {
        throw new BadRequestException(
          `Requested quantity (${alloc.quantity}) exceeds total inventory (${resource.totalQuantity}) for ${resource.name}`,
        );
      }
    }

    // Atomic transaction to replace allocations
    await this.prisma.$transaction(async (tx) => {
      await tx.eventBookingResource.deleteMany({
        where: { bookingId },
      });

      for (const alloc of dto.allocations) {
        await tx.eventBookingResource.create({
          data: {
            id: generateUuidV7(),
            bookingId,
            resourceId: alloc.resourceId,
            quantity: alloc.quantity,
            notes: alloc.notes?.trim() || null,
          },
        });
      }
    });

    return this.getBooking(propertyId, bookingId);
  }

  // ==========================================
  // COMPLETE & FOLIO POSTING
  // ==========================================
  async completeBooking(
    propertyId: string,
    bookingId: string,
    dto: CompleteEventBookingDto,
    actor: SecurityContext,
  ): Promise<EventBookingDto> {
    const booking = await this.prisma.eventBooking.findFirst({
      where: { id: bookingId, propertyId },
      include: { venue: true, package: true },
    });
    if (!booking) {
      throw new NotFoundException(`Event Booking '${bookingId}' not found`);
    }

    if (booking.status === 'COMPLETED') {
      return this.mapToDto(booking);
    }
    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Cannot complete a cancelled event booking');
    }

    let resolvedFolioId: string | null = null;
    let resolvedReservationId: string | null = dto.reservationId || booking.reservationId || null;
    let resolvedRoomNumber: string | null = dto.roomNumber || booking.roomNumber || null;
    let resolvedGuestName: string | null = booking.hostName;
    let resolvedTransactionId: string | null = null;

    if (dto.settlementType === 'ROOM_CHARGE') {
      let targetReservation: any = null;

      if (dto.folioId) {
        const folio = await this.prisma.folio.findFirst({
          where: { id: dto.folioId, propertyId, status: 'OPEN' },
        });
        if (!folio) {
          throw new NotFoundException(`Open Folio '${dto.folioId}' not found`);
        }
        resolvedFolioId = folio.id;
        targetReservation = await this.prisma.reservation.findFirst({
          where: { id: folio.reservationId, propertyId },
          include: { guest: true, assignedRoom: true },
        });
      } else if (dto.roomNumber || booking.roomNumber) {
        const rNum = (dto.roomNumber || booking.roomNumber)!.trim();
        const hotelRoom = await this.prisma.room.findFirst({
          where: { propertyId, roomNumber: rNum },
        });
        if (!hotelRoom) {
          throw new NotFoundException(`Room '${rNum}' not found in property`);
        }

        targetReservation = await this.prisma.reservation.findFirst({
          where: {
            propertyId,
            assignedRoomId: hotelRoom.id,
            status: 'CHECKED_IN',
          },
          include: { guest: true, assignedRoom: true },
        });

        if (!targetReservation) {
          throw new NotFoundException(
            `No active checked-in guest found in Room ${rNum}`,
          );
        }

        const openFolio = await this.prisma.folio.findFirst({
          where: { propertyId, reservationId: targetReservation.id, status: 'OPEN' },
        });
        if (!openFolio) {
          throw new ConflictException(
            `Checked-in reservation ${targetReservation.confirmationNumber} has no open billing folio`,
          );
        }
        resolvedFolioId = openFolio.id;
      } else if (dto.reservationId || booking.reservationId) {
        const resId = dto.reservationId || booking.reservationId!;
        targetReservation = await this.prisma.reservation.findFirst({
          where: { id: resId, propertyId },
          include: { guest: true, assignedRoom: true },
        });
        if (!targetReservation) {
          throw new NotFoundException(`Reservation '${resId}' not found`);
        }
        const openFolio = await this.prisma.folio.findFirst({
          where: { propertyId, reservationId: targetReservation.id, status: 'OPEN' },
        });
        if (!openFolio) {
          throw new ConflictException('Reservation has no open billing folio');
        }
        resolvedFolioId = openFolio.id;
      } else {
        throw new BadRequestException(
          'Room Number, Reservation ID, or Folio ID is required for ROOM_CHARGE settlement',
        );
      }

      if (targetReservation) {
        resolvedReservationId = targetReservation.id;
        resolvedRoomNumber = targetReservation.assignedRoom?.roomNumber || resolvedRoomNumber;
        resolvedGuestName = targetReservation.guest
          ? `${targetReservation.guest.firstName} ${targetReservation.guest.lastName}`
          : resolvedGuestName;
      }

      // Post charge to Folio via FolioService (reusing existing folio cashiering engine)
      const chargeDescription = `Event & Banquet - ${booking.eventName} (${booking.venue.name}) [Booking #${booking.bookingNumber}]`;
      const idempotencyKey = `event_booking_complete_${booking.id}`;

      const txResult = await this.folioService.postCharge(
        propertyId,
        resolvedFolioId!,
        {
          transactionCode: 'BANQUET',
          description: chargeDescription,
          amount: booking.estimatedAmount.toFixed(2),
        },
        actor,
        idempotencyKey,
      );

      resolvedTransactionId = txResult.id;
    }

    const updated = await this.prisma.eventBooking.update({
      where: { id: bookingId },
      data: {
        status: 'COMPLETED',
        settlementType: dto.settlementType,
        paymentMethod:
          dto.settlementType === 'ROOM_CHARGE'
            ? 'ROOM_CHARGE'
            : (dto.paymentMethod || 'CASH'),
        folioId: resolvedFolioId,
        folioTransactionId: resolvedTransactionId,
        reservationId: resolvedReservationId,
        roomNumber: resolvedRoomNumber,
        hostName: resolvedGuestName || booking.hostName,
        completedAt: new Date(),
        completedBy: actor.userId,
        version: { increment: 1 },
      },
      include: {
        venue: true,
        package: true,
        resourceAllocations: {
          include: { resource: true },
        },
      },
    });

    return this.mapToDto(updated);
  }

  // ==========================================
  // IN-HOUSE GUESTS HELPER
  // ==========================================
  async getInHouseGuests(propertyId: string): Promise<Array<{
    reservationId: string;
    confirmationNumber: string;
    roomNumber: string;
    guestName: string;
    folioId: string | null;
  }>> {
    const checkedIn = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: 'CHECKED_IN',
        assignedRoomId: { not: null },
      },
      include: {
        guest: true,
        assignedRoom: true,
      },
    });

    const resIds = checkedIn.map((r: any) => r.id);
    const openFolios = await this.prisma.folio.findMany({
      where: {
        propertyId,
        reservationId: { in: resIds },
        status: 'OPEN',
      },
    });

    const folioMap = new Map<string, string>();
    for (const f of openFolios) {
      if (!folioMap.has(f.reservationId)) {
        folioMap.set(f.reservationId, f.id);
      }
    }

    return checkedIn.map((r: any) => ({
      reservationId: r.id,
      confirmationNumber: r.confirmationNumber,
      roomNumber: r.assignedRoom?.roomNumber || 'Unknown',
      guestName: r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : 'Guest',
      folioId: folioMap.get(r.id) || null,
    }));
  }

  // ==========================================
  // CONFLICT DETECTION
  // ==========================================
  private async checkVenueScheduleConflicts(
    propertyId: string,
    venueId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string,
  ): Promise<void> {
    const conflict = await this.prisma.eventBooking.findFirst({
      where: {
        propertyId,
        venueId,
        status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      include: { venue: true },
    });

    if (conflict) {
      const vName = conflict.venue?.name || 'The requested venue';
      const bNum = conflict.bookingNumber || 'existing';
      const sTime = conflict.startTime?.toISOString ? conflict.startTime.toISOString() : '';
      const eTime = conflict.endTime?.toISOString ? conflict.endTime.toISOString() : '';
      throw new ConflictException(
        `Venue '${vName}' is already booked for another event (#${bNum}) from ${sTime} to ${eTime}`,
      );
    }
  }

  // ==========================================
  // MAPPER
  // ==========================================
  private mapToDto(b: any): EventBookingDto {
    return {
      id: b.id,
      propertyId: b.propertyId,
      bookingNumber: b.bookingNumber,
      venueId: b.venueId,
      venueName: b.venue?.name,
      venueCapacity: b.venue?.capacity,
      packageId: b.packageId,
      packageName: b.package?.name,
      hostName: b.hostName,
      hostEmail: b.hostEmail,
      hostPhone: b.hostPhone,
      eventName: b.eventName,
      eventType: b.eventType as any,
      startTime: b.startTime?.toISOString ? b.startTime.toISOString() : (b.startTime || new Date().toISOString()),
      endTime: b.endTime?.toISOString ? b.endTime.toISOString() : (b.endTime || new Date().toISOString()),
      expectedGuests: b.expectedGuests,
      estimatedAmount: b.estimatedAmount ? (typeof b.estimatedAmount === 'string' ? b.estimatedAmount : b.estimatedAmount.toFixed(2)) : '0.00',
      currency: b.currency,
      status: b.status as any,
      notes: b.notes,
      roomNumber: b.roomNumber,
      reservationId: b.reservationId,
      folioId: b.folioId,
      folioTransactionId: b.folioTransactionId,
      settlementType: b.settlementType as any,
      paymentMethod: b.paymentMethod as any,
      completedAt: b.completedAt?.toISOString ? b.completedAt.toISOString() : b.completedAt,
      completedBy: b.completedBy,
      version: b.version,
      createdAt: b.createdAt?.toISOString ? b.createdAt.toISOString() : (b.createdAt || new Date().toISOString()),
      updatedAt: b.updatedAt?.toISOString ? b.updatedAt.toISOString() : (b.updatedAt || new Date().toISOString()),
      resourceAllocations: (b.resourceAllocations || []).map((ra: any) => ({
        id: ra.id,
        bookingId: ra.bookingId,
        resourceId: ra.resourceId,
        resourceName: ra.resource?.name,
        resourceType: ra.resource?.resourceType,
        quantity: ra.quantity,
        notes: ra.notes,
        createdAt: ra.createdAt?.toISOString ? ra.createdAt.toISOString() : ra.createdAt,
      })),
    };
  }
}

