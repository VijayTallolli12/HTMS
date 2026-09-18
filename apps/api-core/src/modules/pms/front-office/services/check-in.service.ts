import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PropertyBusinessDateService } from '../../common/services/property-business-date.service';
import { RoomStatusService } from '../../room-operations/services/room-status.service';
import {
  CheckInDto,
  CheckInResponseDto,
  HousekeepingStatus,
  PmsEventType,
  ReservationDto,
  ReservationStatus,
  RoomOccupancyStatus,
  RoomServiceStatus,
  RoomStatusDto,
  SecurityContext,
} from '@hms/api-contracts';
import { createCloudEvent } from '@hms/shared';

function computeCheckInPayloadHash(dto: CheckInDto): string {
  const normalized = {
    allowCleanOverride: !!dto.allowCleanOverride,
    overrideReason: dto.overrideReason?.trim() || null,
    identityVerified: !!dto.identityVerified,
    registrationCardSigned: !!dto.registrationCardSigned,
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

@Injectable()
export class CheckInService {
  private readonly logger = new Logger(CheckInService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly businessDateService: PropertyBusinessDateService,
    private readonly roomStatusService: RoomStatusService,
  ) {}

  /**
   * Orchestrates the arrival check-in of a confirmed, room-assigned reservation.
   */
  public async checkIn(
    propertyId: string,
    reservationId: string,
    dto: CheckInDto,
    actor: SecurityContext,
    idempotencyKey?: string,
  ): Promise<CheckInResponseDto> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

    const payloadHash = computeCheckInPayloadHash(dto);

    // 1. Check idempotency if key provided
    if (idempotencyKey) {
      const existingWithKey = await this.prisma.reservation.findUnique({
        where: {
          uq_reservations_checkin_idempotency: {
            propertyId,
            checkInIdempotencyKey: idempotencyKey,
          },
        },
        include: {
          guest: true,
          roomType: true,
          ratePlan: true,
          assignedRoom: true,
          rateNights: { orderBy: { businessDate: 'asc' } },
        },
      });

      if (existingWithKey) {
        // Case B: Same key used for DIFFERENT reservation
        if (existingWithKey.id !== reservationId) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            errorCode: 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_ENTITY',
            message: `Idempotency key '${idempotencyKey}' has already been used for another reservation in this property`,
          });
        }

        // Case C: Same reservation + SAME key + DIFFERENT payload
        if (existingWithKey.checkInPayloadHash !== payloadHash) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
            message: `Idempotency key '${idempotencyKey}' was already submitted with different check-in parameters`,
          });
        }

        // Case A: Same reservation + same key + same payload -> Idempotent success
        this.logger.log(
          `Idempotent check-in request resolved for key '${idempotencyKey}' on reservation ${existingWithKey.confirmationNumber}`,
        );

        const roomStatus = await this.roomStatusService.findById(
          propertyId,
          existingWithKey.assignedRoomId!,
        );

        return {
          reservation: this.mapToReservationDto(existingWithKey),
          room: roomStatus,
          checkInAt: existingWithKey.checkInAt
            ? existingWithKey.checkInAt.toISOString()
            : new Date().toISOString(),
          checkedInBy: existingWithKey.checkedInBy || actor.userId,
        };
      }
    }

    // 2. Pre-flight reservation validation
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, propertyId, deletedAt: null },
      include: {
        guest: true,
        roomType: true,
        ratePlan: true,
        assignedRoom: true,
        rateNights: { orderBy: { businessDate: 'asc' } },
      },
    });
    if (!reservation) {
      throw new NotFoundException(
        `Reservation '${reservationId}' not found on property '${propertyId}'`,
      );
    }

    // Case D: Already CHECKED_IN without matching key
    if (reservation.status === ReservationStatus.CHECKED_IN) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        errorCode: 'RESERVATION_ALREADY_CHECKED_IN',
        message: `Reservation '${reservation.confirmationNumber}' is already in CHECKED_IN status`,
      });
    }

    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new ConflictException(
        `Cannot check in reservation with status '${reservation.status}'. Only CONFIRMED reservations can be checked in.`,
      );
    }

    if (!reservation.assignedRoomId) {
      throw new BadRequestException(
        `Reservation '${reservation.confirmationNumber}' does not have an assigned room. Please assign a room before checking in.`,
      );
    }

    // 3. Business date arrival validation
    const currentBusinessDate = this.businessDateService.getCurrentBusinessDate(property.timeZone);
    const busDateStr = currentBusinessDate.toISOString().slice(0, 10);
    const arrDateStr = reservation.arrivalDate.toISOString().slice(0, 10);

    if (arrDateStr > busDateStr) {
      throw new BadRequestException(
        `Check-in is blocked: reservation arrival date (${arrDateStr}) is after property business date (${busDateStr}). Prior-date check-in requires stay modification.`,
      );
    }

    if (arrDateStr < busDateStr) {
      throw new BadRequestException(
        `Check-in is blocked: reservation arrival date (${arrDateStr}) is in the past compared to property business date (${busDateStr}). Please modify stay dates or reinstate reservation.`,
      );
    }

    // 4. Clean override authorization check
    if (dto.allowCleanOverride) {
      const hasCleanOverridePerm = actor.permissions?.has('front_office.checkin.clean_override');
      if (!hasCleanOverridePerm) {
        throw new ForbiddenException(
          `Actor lacks 'front_office.checkin.clean_override' permission to check in a CLEAN room`,
        );
      }
    }

    const assignedRoomId = reservation.assignedRoomId;
    const now = new Date();

    // 5. Execute Atomic Check-In Transaction
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // A. Delegate operational readiness verification & occupancy mutation to T06
          const occupied = await this.roomStatusService.occupyRoom(
            propertyId,
            assignedRoomId,
            {
              allowCleanOverride: dto.allowCleanOverride,
              actorId: actor.userId,
              reason: dto.overrideReason,
            },
            tx,
          );

          // B. Update Reservation with OCC version check
          const updateRes = await tx.reservation.updateMany({
            where: {
              id: reservation.id,
              propertyId,
              version: reservation.version,
              status: ReservationStatus.CONFIRMED,
            },
            data: {
              status: ReservationStatus.CHECKED_IN,
              checkInAt: now,
              checkedInBy: actor.userId,
              checkInIdempotencyKey: idempotencyKey || null,
              checkInPayloadHash: idempotencyKey ? payloadHash : null,
              version: { increment: 1 },
            },
          });

          if (updateRes.count === 0) {
            throw new ConflictException(
              `Optimistic concurrency conflict while checking in reservation '${reservation.confirmationNumber}'. Please retry.`,
            );
          }

          // C. Emit CloudEvent GUEST_CHECKED_IN
          const event = createCloudEvent({
            type: PmsEventType.GUEST_CHECKED_IN,
            source: `https://pms.enterprise-hms.com/properties/${propertyId}/reservations/${reservation.id}`,
            subject: reservation.id,
            propertyId,
            data: {
              propertyId,
              reservationId: reservation.id,
              confirmationNumber: reservation.confirmationNumber,
              guestId: reservation.guestId,
              roomId: assignedRoomId,
              roomNumber: occupied.room.roomNumber,
              checkInAt: now.toISOString(),
              actorId: actor.userId,
              allowCleanOverride: !!dto.allowCleanOverride,
              identityVerified: !!dto.identityVerified,
            },
          });

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

          const updatedReservation = await tx.reservation.findUniqueOrThrow({
            where: { id: reservation.id },
            include: {
              guest: true,
              roomType: true,
              ratePlan: true,
              assignedRoom: true,
              rateNights: { orderBy: { businessDate: 'asc' } },
            },
          });

          const roomDto: RoomStatusDto = {
            roomId: occupied.room.id,
            propertyId: occupied.room.propertyId,
            roomNumber: occupied.room.roomNumber,
            roomTypeId: occupied.room.roomTypeId,
            housekeepingStatus: occupied.room.housekeepingStatus as HousekeepingStatus,
            serviceStatus: occupied.room.serviceStatus as RoomServiceStatus,
            occupancyStatus: occupied.room.occupancyStatus as RoomOccupancyStatus,
            version: occupied.room.version,
            effective: occupied.effective,
          };

          return {
            reservation: this.mapToReservationDto(updatedReservation),
            room: roomDto,
            checkInAt: now.toISOString(),
            checkedInBy: actor.userId,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10000,
        },
      );
    } catch (error: any) {
      // Case E: Concurrent same-key race (P2002 on unique constraint or OCC collision on Room/Reservation version)
      if (
        idempotencyKey &&
        (error.code === 'P2002' ||
          error.message?.includes('uq_reservations_checkin_idempotency') ||
          error instanceof ConflictException)
      ) {
        let committedWithKey = await this.prisma.reservation.findUnique({
          where: {
            uq_reservations_checkin_idempotency: {
              propertyId,
              checkInIdempotencyKey: idempotencyKey,
            },
          },
          include: {
            guest: true,
            roomType: true,
            ratePlan: true,
            assignedRoom: true,
            rateNights: { orderBy: { businessDate: 'asc' } },
          },
        });

        if (!committedWithKey && error instanceof ConflictException) {
          // Brief pause to allow the racing committing transaction to finish
          await new Promise((resolve) => setTimeout(resolve, 150));
          committedWithKey = await this.prisma.reservation.findUnique({
            where: {
              uq_reservations_checkin_idempotency: {
                propertyId,
                checkInIdempotencyKey: idempotencyKey,
              },
            },
            include: {
              guest: true,
              roomType: true,
              ratePlan: true,
              assignedRoom: true,
              rateNights: { orderBy: { businessDate: 'asc' } },
            },
          });
        }

        if (committedWithKey) {
          if (committedWithKey.id !== reservationId) {
            throw new ConflictException({
              statusCode: 409,
              error: 'Conflict',
              errorCode: 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_ENTITY',
              message: `Idempotency key '${idempotencyKey}' has already been used for another reservation in this property`,
            });
          }

          if (committedWithKey.checkInPayloadHash !== payloadHash) {
            throw new ConflictException({
              statusCode: 409,
              error: 'Conflict',
              errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
              message: `Idempotency key '${idempotencyKey}' was already submitted with different check-in parameters`,
            });
          }

          const roomStatus = await this.roomStatusService.findById(
            propertyId,
            committedWithKey.assignedRoomId!,
          );

          return {
            reservation: this.mapToReservationDto(committedWithKey),
            room: roomStatus,
            checkInAt: committedWithKey.checkInAt
              ? committedWithKey.checkInAt.toISOString()
              : now.toISOString(),
            checkedInBy: committedWithKey.checkedInBy || actor.userId,
          };
        }
      }

      throw error;
    }
  }

  private mapToReservationDto(res: any): ReservationDto {
    const nights = Math.round(
      (new Date(res.departureDate).getTime() - new Date(res.arrivalDate).getTime()) /
        (24 * 60 * 60 * 1000),
    );

    return {
      id: res.id,
      propertyId: res.propertyId,
      confirmationNumber: res.confirmationNumber,
      status: res.status as ReservationStatus,
      guestId: res.guestId,
      guest: res.guest
        ? {
            id: res.guest.id,
            propertyId: res.guest.propertyId,
            firstName: res.guest.firstName,
            lastName: res.guest.lastName,
            email: res.guest.email,
            phone: res.guest.phone,
            identificationType: res.guest.identificationType,
            identificationNumber: res.guest.identificationNumber,
            crmProfileId: res.guest.crmProfileId,
            createdAt: res.guest.createdAt.toISOString(),
            updatedAt: res.guest.updatedAt.toISOString(),
          }
        : undefined,
      roomTypeId: res.roomTypeId,
      roomTypeCode: res.roomType?.code,
      roomTypeName: res.roomType?.name,
      ratePlanId: res.ratePlanId,
      ratePlanCode: res.ratePlan?.code,
      ratePlanName: res.ratePlan?.name,
      arrivalDate: res.arrivalDate.toISOString().slice(0, 10),
      departureDate: res.departureDate.toISOString().slice(0, 10),
      nightsCount: nights,
      adultsCount: res.adultsCount,
      childrenCount: res.childrenCount,
      totalAmount: Number(res.totalAmount),
      currency: res.currency,
      specialRequests: res.specialRequests,
      cancellationReason: res.cancellationReason,
      cancelledAt: res.cancelledAt ? res.cancelledAt.toISOString() : null,
      assignedRoomId: res.assignedRoomId,
      assignedAt: res.assignedAt ? res.assignedAt.toISOString() : null,
      assignedBy: res.assignedBy,
      checkInAt: res.checkInAt ? res.checkInAt.toISOString() : null,
      checkedInBy: res.checkedInBy,
      assignedRoom: res.assignedRoom
        ? {
            id: res.assignedRoom.id,
            propertyId: res.assignedRoom.propertyId,
            buildingId: res.assignedRoom.buildingId,
            floorId: res.assignedRoom.floorId,
            roomTypeId: res.assignedRoom.roomTypeId,
            roomNumber: res.assignedRoom.roomNumber,
            name: res.assignedRoom.name,
            features: res.assignedRoom.features as any,
            isActive: res.assignedRoom.isActive,
            createdAt: res.assignedRoom.createdAt
              ? res.assignedRoom.createdAt.toISOString()
              : new Date().toISOString(),
            updatedAt: res.assignedRoom.updatedAt
              ? res.assignedRoom.updatedAt.toISOString()
              : new Date().toISOString(),
            deletedAt: res.assignedRoom.deletedAt ? res.assignedRoom.deletedAt.toISOString() : null,
          }
        : null,
      version: res.version,
      rateNights: res.rateNights
        ? res.rateNights.map((rn: any) => ({
            id: rn.id,
            businessDate: rn.businessDate.toISOString().slice(0, 10),
            baseRateAmount: Number(rn.baseRateAmount),
            extraAdultRate: Number(rn.extraAdultRate),
            extraChildRate: Number(rn.extraChildRate),
            totalAmount: Number(rn.totalAmount),
            currency: rn.currency,
          }))
        : undefined,
      createdAt: res.createdAt.toISOString(),
      updatedAt: res.updatedAt.toISOString(),
    };
  }
}
