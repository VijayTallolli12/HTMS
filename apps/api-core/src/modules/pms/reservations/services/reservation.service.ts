import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CancelReservationDto,
  CreateReservationDto,
  QueryReservationsDto,
  ReservationDto,
  ReservationRateNightDto,
  ReservationStatus,
  PmsEventType,
} from '@hms/api-contracts';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';
import { PrismaService } from '../../../../common/database/prisma.service';
import { InventoryService } from '../../inventory/services/inventory.service';
import { PropertyBusinessDateService } from '../../common/services/property-business-date.service';
import { generateConfirmationNumber } from '../utils/confirmation-number.generator';

function toUtcMidnight(dateInput: string | Date): Date {
  const str =
    typeof dateInput === 'string' ? dateInput.slice(0, 10) : dateInput.toISOString().slice(0, 10);
  return new Date(`${str}T00:00:00.000Z`);
}

function formatDateString(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly businessDateService: PropertyBusinessDateService,
  ) {}

  /**
   * Creates a new individual reservation atomically with multi-day inventory booking,
   * guest creation/linkage, and date-by-date pricing snapshots.
   */
  public async create(
    propertyId: string,
    dto: CreateReservationDto,
    idempotencyKey?: string,
  ): Promise<ReservationDto> {
    // 1. Check idempotency if key provided
    if (idempotencyKey) {
      const existing = await this.prisma.reservation.findUnique({
        where: {
          uq_reservations_property_idempotency_key: {
            propertyId,
            idempotencyKey,
          },
        },
        include: {
          guest: true,
          roomType: true,
          ratePlan: true,
          rateNights: {
            orderBy: { businessDate: 'asc' },
          },
        },
      });

      if (existing) {
        this.logger.log(
          `Idempotent reservation request resolved for key ${idempotencyKey} on property ${propertyId}`,
        );
        return this.mapToDto(existing);
      }
    }

    // 2. Validate property
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // 3. Validate stay dates
    const arr = toUtcMidnight(dto.arrivalDate);
    const dep = toUtcMidnight(dto.departureDate);

    if (arr >= dep) {
      throw new BadRequestException('departureDate must be strictly after arrivalDate');
    }

    const nights = Math.round((dep.getTime() - arr.getTime()) / (24 * 60 * 60 * 1000));
    if (nights > 90) {
      throw new BadRequestException('Reservation stay length cannot exceed 90 nights');
    }

    // 4. Validate RoomType
    const roomType = await this.prisma.roomType.findFirst({
      where: {
        id: dto.roomTypeId,
        propertyId,
        isActive: true,
        deletedAt: null,
      },
    });
    if (!roomType) {
      throw new NotFoundException('Room type not found or inactive');
    }

    // Validate physical occupancy invariants
    const totalGuests = dto.adultsCount + (dto.childrenCount || 0);
    if (
      dto.adultsCount > roomType.maxAdults ||
      (dto.childrenCount !== undefined && dto.childrenCount > roomType.maxChildren) ||
      totalGuests > roomType.maxOccupancy
    ) {
      throw new BadRequestException('Occupancy exceeds room type physical capacity');
    }

    // 5. Validate RatePlan and RoomType mapping
    const ratePlan = await this.prisma.ratePlan.findFirst({
      where: {
        id: dto.ratePlanId,
        propertyId,
        isActive: true,
        deletedAt: null,
      },
    });
    if (!ratePlan) {
      throw new NotFoundException('Rate plan not found or inactive');
    }

    const mapping = await this.prisma.ratePlanRoomType.findFirst({
      where: {
        ratePlanId: dto.ratePlanId,
        roomTypeId: dto.roomTypeId,
        propertyId,
        isActive: true,
        deletedAt: null,
      },
    });
    if (!mapping) {
      throw new BadRequestException('Rate plan is not applicable to the specified room type');
    }

    // 6. Pre-flight Stay Quote & Restriction Evaluation via T04 InventoryService
    const quote = await this.inventoryService.getStayQuote(propertyId, {
      arrivalDate: formatDateString(arr),
      departureDate: formatDateString(dep),
      adults: dto.adultsCount,
      children: dto.childrenCount,
      roomTypeId: dto.roomTypeId,
    });

    const option = quote.options.find(
      (o) => o.ratePlanId === dto.ratePlanId && o.roomTypeId === dto.roomTypeId,
    );

    if (!option || !option.isAvailable) {
      throw new ConflictException(
        option?.rejectionReason ||
          'Selected room type and rate plan are not available for the requested stay window',
      );
    }

    const nightlyRates = option.nightlyRates;
    if (nightlyRates.length !== nights) {
      throw new ConflictException('Nightly rates count does not match length of stay');
    }

    // Validate total matching invariant
    const calculatedTotal = Number(option.totalAmount);
    const totalDecimal = new Prisma.Decimal(option.totalAmount);

    // 7. Resolve Guest details (No implicit heuristic merging)
    let resolvedGuestId: string;
    let newGuestData: Prisma.GuestUncheckedCreateInput | null = null;

    if (dto.guestId) {
      const existingGuest = await this.prisma.guest.findFirst({
        where: { id: dto.guestId, propertyId, deletedAt: null },
      });
      if (!existingGuest) {
        throw new NotFoundException('Specified guestId not found on this property');
      }
      resolvedGuestId = existingGuest.id;
    } else {
      if (!dto.guest || !dto.guest.firstName || !dto.guest.lastName) {
        throw new BadRequestException(
          'Guest details (firstName, lastName) are required when guestId is not provided',
        );
      }
      resolvedGuestId = generateUuidV7();
      newGuestData = {
        id: resolvedGuestId,
        propertyId,
        firstName: dto.guest.firstName.trim(),
        lastName: dto.guest.lastName.trim(),
        email: dto.guest.email?.trim() || null,
        phone: dto.guest.phone?.trim() || null,
        identificationType: dto.guest.identificationType?.trim() || null,
        identificationNumber: dto.guest.identificationNumber?.trim() || null,
        crmProfileId: null,
      };
    }

    // 8. Generate collision-resistant confirmation number
    let confirmationNumber = generateConfirmationNumber(property.code);
    let attempts = 0;
    while (attempts < 3) {
      const existingConf = await this.prisma.reservation.findUnique({
        where: {
          uq_reservations_property_confirmation_number: {
            propertyId,
            confirmationNumber,
          },
        },
      });
      if (!existingConf) break;
      confirmationNumber = generateConfirmationNumber(property.code);
      attempts++;
    }

    const reservationId = generateUuidV7();

    const event = createCloudEvent({
      type: PmsEventType.RESERVATION_CREATED,
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/reservations/${reservationId}`,
      subject: reservationId,
      propertyId,
      data: {
        reservationId,
        propertyId,
        confirmationNumber,
        guestId: resolvedGuestId,
        roomTypeId: dto.roomTypeId,
        ratePlanId: dto.ratePlanId,
        arrivalDate: formatDateString(arr),
        departureDate: formatDateString(dep),
        nightsCount: nights,
        adultsCount: dto.adultsCount,
        childrenCount: dto.childrenCount || 0,
        totalAmount: calculatedTotal,
        currency: ratePlan.currency,
      },
    });

    // 9. Execute Atomic Booking Transaction
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          // A. Reserve inventory range using tx (OCC)
          await this.inventoryService.reserveInventoryRange(
            propertyId,
            dto.roomTypeId,
            arr,
            dep,
            1,
            tx,
          );

          // B. Create guest record if needed
          if (newGuestData) {
            await tx.guest.create({ data: newGuestData });
          }

          // C. Create reservation record
          const reservation = await tx.reservation.create({
            data: {
              id: reservationId,
              propertyId,
              confirmationNumber,
              idempotencyKey: idempotencyKey || null,
              status: ReservationStatus.CONFIRMED,
              guestId: resolvedGuestId,
              roomTypeId: dto.roomTypeId,
              ratePlanId: dto.ratePlanId,
              arrivalDate: arr,
              departureDate: dep,
              adultsCount: dto.adultsCount,
              childrenCount: dto.childrenCount || 0,
              totalAmount: totalDecimal,
              currency: ratePlan.currency,
              specialRequests: dto.specialRequests ? dto.specialRequests.trim() : null,
              version: 0,
            },
          });

          // D. Create nightly rate snapshots
          const rateNightsData = nightlyRates.map((nr) => ({
            id: generateUuidV7(),
            propertyId,
            reservationId,
            businessDate: toUtcMidnight(nr.date),
            baseRateAmount: new Prisma.Decimal(nr.amount),
            extraAdultRate: new Prisma.Decimal(0),
            extraChildRate: new Prisma.Decimal(0),
            totalAmount: new Prisma.Decimal(nr.amount),
            currency: ratePlan.currency,
          }));

          await tx.reservationRateNight.createMany({
            data: rateNightsData,
          });

          // E. Create outbox event in same transaction
          await tx.outboxEvent.create({
            data: {
              id: event.id,
              specversion: event.specversion,
              type: event.type,
              source: event.source,
              subject: event.subject,
              propertyId,
              datacontenttype: event.datacontenttype,
              time: new Date(event.time),
              data: event.data as any,
              correlationId: event.correlationid,
              causationId: event.causationid,
            },
          });

          return reservation;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 15000,
        },
      );

      this.logger.log(
        `Reservation confirmed: ${result.confirmationNumber} (${result.id}) on property ${propertyId}`,
      );

      return this.findById(propertyId, result.id);
    } catch (err: any) {
      if (idempotencyKey) {
        // If a concurrent request with the same idempotency key succeeded, resolve to it
        for (let retry = 0; retry < 6; retry++) {
          const existing = await this.prisma.reservation.findUnique({
            where: {
              uq_reservations_property_idempotency_key: {
                propertyId,
                idempotencyKey,
              },
            },
            include: {
              guest: true,
              roomType: true,
              ratePlan: true,
              rateNights: {
                orderBy: { businessDate: 'asc' },
              },
            },
          });
          if (existing) {
            return this.mapToDto(existing);
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
      throw err;
    }
  }

  /**
   * Cancels a confirmed reservation atomically: releases inventory across stay nights,
   * transitions status to CANCELLED, and writes an outbox event.
   */
  public async cancel(
    propertyId: string,
    reservationId: string,
    dto: CancelReservationDto,
  ): Promise<ReservationDto> {
    const existing = await this.prisma.reservation.findFirst({
      where: { id: reservationId, propertyId, deletedAt: null },
      include: {
        rateNights: {
          orderBy: { businessDate: 'asc' },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Reservation not found');
    }

    if (existing.status === ReservationStatus.CANCELLED) {
      throw new ConflictException('Reservation is already cancelled');
    }

    if (existing.status !== ReservationStatus.CONFIRMED) {
      throw new ConflictException(`Cannot cancel reservation in ${existing.status} status`);
    }

    const nightsCount = existing.rateNights.length;
    const now = new Date();

    const event = createCloudEvent({
      type: PmsEventType.RESERVATION_CANCELLED,
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/reservations/${reservationId}`,
      subject: reservationId,
      propertyId,
      data: {
        reservationId,
        propertyId,
        confirmationNumber: existing.confirmationNumber,
        roomTypeId: existing.roomTypeId,
        arrivalDate: formatDateString(existing.arrivalDate),
        departureDate: formatDateString(existing.departureDate),
        nightsCount,
        reason: dto.reason.trim(),
        cancelledAt: now.toISOString(),
      },
    });

    await this.prisma.$transaction(
      async (tx) => {
        // 1. Release inventory range using tx (OCC)
        await this.inventoryService.releaseInventoryRange(
          propertyId,
          existing.roomTypeId,
          existing.arrivalDate,
          existing.departureDate,
          1,
          tx,
        );

        // 2. OCC update on reservation status
        const updateRes = await tx.reservation.updateMany({
          where: {
            id: reservationId,
            propertyId,
            status: ReservationStatus.CONFIRMED,
            version: existing.version,
          },
          data: {
            status: ReservationStatus.CANCELLED,
            cancellationReason: dto.reason.trim(),
            cancelledAt: now,
            version: { increment: 1 },
          },
        });

        if (updateRes.count === 0) {
          throw new ConflictException(
            'Optimistic concurrency conflict while cancelling reservation',
          );
        }

        // 3. Write outbox event
        await tx.outboxEvent.create({
          data: {
            id: event.id,
            specversion: event.specversion,
            type: event.type,
            source: event.source,
            subject: event.subject,
            propertyId,
            datacontenttype: event.datacontenttype,
            time: new Date(event.time),
            data: event.data as any,
            correlationId: event.correlationid,
            causationId: event.causationid,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
      },
    );

    this.logger.log(
      `Reservation cancelled: ${existing.confirmationNumber} (${reservationId}) on property ${propertyId}`,
    );

    return this.findById(propertyId, reservationId);
  }

  /**
   * Retrieves reservation by ID with full guest, room type, rate plan, and nightly snapshot breakdown.
   */
  public async findById(propertyId: string, reservationId: string): Promise<ReservationDto> {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: reservationId,
        propertyId,
        deletedAt: null,
      },
      include: {
        guest: true,
        roomType: true,
        ratePlan: true,
        rateNights: {
          orderBy: { businessDate: 'asc' },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    return this.mapToDto(reservation);
  }

  /**
   * Lists reservations with property-scoped filtering and pagination.
   */
  public async findAll(
    propertyId: string,
    query: QueryReservationsDto,
  ): Promise<{ items: ReservationDto[]; total: number; page: number; limit: number }> {
    const where: Prisma.ReservationWhereInput = {
      propertyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
      ...(query.confirmationNumber ? { confirmationNumber: query.confirmationNumber.trim() } : {}),
      ...(query.arrivalDate ? { arrivalDate: toUtcMidnight(query.arrivalDate) } : {}),
      ...(query.departureDate ? { departureDate: toUtcMidnight(query.departureDate) } : {}),
      ...(query.guestName
        ? {
            guest: {
              OR: [
                { firstName: { contains: query.guestName, mode: 'insensitive' } },
                { lastName: { contains: query.guestName, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        include: {
          guest: true,
          roomType: true,
          ratePlan: true,
          rateNights: {
            orderBy: { businessDate: 'asc' },
          },
        },
        orderBy: [{ arrivalDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return {
      items: items.map((r) => this.mapToDto(r)),
      total,
      page,
      limit,
    };
  }

  private mapToDto(entity: any): ReservationDto {
    const nightsCount = entity.rateNights ? entity.rateNights.length : 0;

    const rateNights: ReservationRateNightDto[] = entity.rateNights
      ? entity.rateNights.map((rn: any) => ({
          id: rn.id,
          businessDate: formatDateString(rn.businessDate),
          baseRateAmount: Number(rn.baseRateAmount),
          extraAdultRate: Number(rn.extraAdultRate),
          extraChildRate: Number(rn.extraChildRate),
          totalAmount: Number(rn.totalAmount),
          currency: rn.currency,
        }))
      : [];

    return {
      id: entity.id,
      propertyId: entity.propertyId,
      confirmationNumber: entity.confirmationNumber,
      status: entity.status as ReservationStatus,
      guestId: entity.guestId,
      guest: entity.guest
        ? {
            id: entity.guest.id,
            propertyId: entity.guest.propertyId,
            firstName: entity.guest.firstName,
            lastName: entity.guest.lastName,
            email: entity.guest.email,
            phone: entity.guest.phone,
            identificationType: entity.guest.identificationType,
            identificationNumber: entity.guest.identificationNumber,
            crmProfileId: entity.guest.crmProfileId,
            createdAt: entity.guest.createdAt.toISOString(),
            updatedAt: entity.guest.updatedAt.toISOString(),
          }
        : undefined,
      roomTypeId: entity.roomTypeId,
      roomTypeCode: entity.roomType?.code,
      roomTypeName: entity.roomType?.name,
      ratePlanId: entity.ratePlanId,
      ratePlanCode: entity.ratePlan?.code,
      ratePlanName: entity.ratePlan?.name,
      arrivalDate: formatDateString(entity.arrivalDate),
      departureDate: formatDateString(entity.departureDate),
      nightsCount,
      adultsCount: entity.adultsCount,
      childrenCount: entity.childrenCount,
      totalAmount: Number(entity.totalAmount),
      currency: entity.currency,
      specialRequests: entity.specialRequests,
      cancellationReason: entity.cancellationReason,
      cancelledAt: entity.cancelledAt ? entity.cancelledAt.toISOString() : null,
      version: entity.version,
      rateNights,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
