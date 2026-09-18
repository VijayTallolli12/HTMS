import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PropertyBusinessDateService } from '../../common/services/property-business-date.service';
import { RoomStatusReconciliationService } from '../../room-operations/services/room-status-reconciliation.service';
import {
  AssignRoomDto,
  EligibleRoomDto,
  PmsEventType,
  QueryEligibleRoomsDto,
  ReservationAssignmentLogDto,
  ReservationDto,
  ReservationStatus,
  SecurityContext,
  UnassignRoomDto,
} from '@hms/api-contracts';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';

function isGiSTExclusionConflict(error: any): boolean {
  if (!error) return false;
  const msg = error.message || '';
  return (
    error.code === '23P01' ||
    error.code === 'P2002' ||
    msg.includes('exclude_overlapping_room_assignments') ||
    msg.includes('exclusion constraint') ||
    msg.includes('conflicting key value violates exclusion constraint')
  );
}

@Injectable()
export class RoomAssignmentService {
  private readonly logger = new Logger(RoomAssignmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly businessDateService: PropertyBusinessDateService,
    private readonly reconciliationService: RoomStatusReconciliationService,
  ) {}

  /**
   * Evaluates and returns all physical rooms eligible for assignment to the target reservation.
   */
  public async getEligibleRooms(
    propertyId: string,
    query: QueryEligibleRoomsDto,
  ): Promise<EligibleRoomDto[]> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: { id: query.reservationId, propertyId, deletedAt: null },
      include: { roomType: true },
    });
    if (!reservation) {
      throw new NotFoundException(
        `Reservation '${query.reservationId}' not found on property '${propertyId}'`,
      );
    }

    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new ConflictException(
        `Cannot query eligible rooms for reservation with status '${reservation.status}'`,
      );
    }

    const currentBusinessDate = this.businessDateService.getCurrentBusinessDate(property.timeZone);

    // Fetch candidate rooms
    const candidateRooms = await this.prisma.room.findMany({
      where: {
        propertyId,
        isActive: true,
        deletedAt: null,
        ...(query.buildingId ? { buildingId: query.buildingId } : {}),
        ...(query.floorId ? { floorId: query.floorId } : {}),
      },
      include: { roomType: true },
      orderBy: { roomNumber: 'asc' },
    });

    const eligibleRooms: EligibleRoomDto[] = [];

    for (const room of candidateRooms) {
      // 1. Check overlapping active maintenance blocks for the reservation stay window
      const maintenanceConflict = await this.prisma.roomMaintenanceBlock.findFirst({
        where: {
          propertyId,
          roomId: room.id,
          status: 'ACTIVE',
          deletedAt: null,
          startDate: { lt: reservation.departureDate },
          endDate: { gt: reservation.arrivalDate },
        },
      });
      if (maintenanceConflict) {
        continue;
      }

      // 2. Check overlapping active reservation assignments for the stay window
      const assignmentConflict = await this.prisma.reservation.findFirst({
        where: {
          propertyId,
          assignedRoomId: room.id,
          id: { not: reservation.id },
          status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
          deletedAt: null,
          arrivalDate: { lt: reservation.departureDate },
          departureDate: { gt: reservation.arrivalDate },
        },
      });
      if (assignmentConflict) {
        continue;
      }

      // 3. Resolve effective state for current business date
      const activeBlockToday = await this.prisma.roomMaintenanceBlock.findFirst({
        where: {
          propertyId,
          roomId: room.id,
          status: 'ACTIVE',
          deletedAt: null,
          startDate: { lte: currentBusinessDate },
          endDate: { gt: currentBusinessDate },
        },
      });

      const effective = this.reconciliationService.resolveEffectiveState(
        room,
        activeBlockToday,
        currentBusinessDate,
      );

      // Filter dirty if requested
      if (
        query.includeDirty === false &&
        ['DIRTY', 'CLEANING', 'PICKUP'].includes(room.housekeepingStatus)
      ) {
        continue;
      }

      const isUpgrade = room.roomTypeId !== reservation.roomTypeId;

      eligibleRooms.push({
        id: room.id,
        propertyId: room.propertyId,
        roomNumber: room.roomNumber,
        roomTypeId: room.roomTypeId,
        roomTypeCode: room.roomType.code,
        roomTypeName: room.roomType.name,
        buildingId: room.buildingId,
        floorId: room.floorId,
        housekeepingStatus: room.housekeepingStatus,
        serviceStatus: room.serviceStatus,
        occupancyStatus: room.occupancyStatus,
        isCheckInReady: effective.isCheckInReady,
        isUpgrade,
      });
    }

    return eligibleRooms;
  }

  /**
   * Assigns, reassigns, or no-ops a physical room for a confirmed reservation.
   */
  public async assignRoom(
    propertyId: string,
    reservationId: string,
    dto: AssignRoomDto,
    actor: SecurityContext,
  ): Promise<ReservationDto> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

    // 1. Pre-flight reservation lookup
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

    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new ConflictException(
        `Cannot assign room to reservation with status '${reservation.status}'. Only CONFIRMED reservations can be assigned.`,
      );
    }

    // 2. Strict Same-Room Assignment NO-OP
    if (reservation.assignedRoomId === dto.roomId) {
      this.logger.log(
        `Same-room assignment NO-OP for reservation ${reservation.confirmationNumber} on room ${dto.roomId}`,
      );
      return this.mapToReservationDto(reservation);
    }

    // 3. Pre-flight target room lookup
    const targetRoom = await this.prisma.room.findFirst({
      where: { id: dto.roomId, propertyId, deletedAt: null },
    });
    if (!targetRoom) {
      throw new NotFoundException(
        `Target room '${dto.roomId}' not found on property '${propertyId}'`,
      );
    }

    if (!targetRoom.isActive) {
      throw new BadRequestException(`Target room '${targetRoom.roomNumber}' is inactive`);
    }

    // 4. Validate room type matching & upgrade permissions
    if (targetRoom.roomTypeId !== reservation.roomTypeId) {
      if (!dto.allowUpgrade) {
        throw new BadRequestException(
          `Target room '${targetRoom.roomNumber}' is of type '${targetRoom.roomTypeId}', which does not match reservation room type '${reservation.roomTypeId}'. To upgrade, pass allowUpgrade: true.`,
        );
      }
      const hasUpgradePerm = actor.permissions?.has('front_office.room_assignment.upgrade');
      if (!hasUpgradePerm) {
        throw new ForbiddenException(
          `Actor lacks 'front_office.room_assignment.upgrade' permission for room type upgrade`,
        );
      }
    }

    const prevRoomId = reservation.assignedRoomId;
    const isReassignment = !!prevRoomId;

    // 5. Execute Atomic Assignment Transaction
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // A. Lock physical room rows in lexicographical ascending order to prevent deadlocks
          if (isReassignment && prevRoomId) {
            const sortedRoomIds = [prevRoomId, dto.roomId].sort();
            for (const rId of sortedRoomIds) {
              const currentR = await tx.room.findUniqueOrThrow({ where: { id: rId } });
              const bumpRes = await tx.room.updateMany({
                where: { id: rId, propertyId, version: currentR.version },
                data: { version: { increment: 1 } },
              });
              if (bumpRes.count === 0) {
                throw new ConflictException(
                  `Optimistic concurrency conflict while locking room '${rId}'. Please retry.`,
                );
              }
            }
          } else {
            const currentR = await tx.room.findUniqueOrThrow({ where: { id: dto.roomId } });
            const bumpRes = await tx.room.updateMany({
              where: { id: dto.roomId, propertyId, version: currentR.version },
              data: { version: { increment: 1 } },
            });
            if (bumpRes.count === 0) {
              throw new ConflictException(
                `Optimistic concurrency conflict while locking room '${targetRoom.roomNumber}'. Please retry.`,
              );
            }
          }

          // B. Verify no active maintenance block on target room during stay window
          const maintenanceConflict = await tx.roomMaintenanceBlock.findFirst({
            where: {
              propertyId,
              roomId: dto.roomId,
              status: 'ACTIVE',
              deletedAt: null,
              startDate: { lt: reservation.departureDate },
              endDate: { gt: reservation.arrivalDate },
            },
          });
          if (maintenanceConflict) {
            throw new ConflictException(
              `Target room '${targetRoom.roomNumber}' is under active maintenance during requested stay window`,
            );
          }

          // C. Mutate reservation with OCC version check
          const now = new Date();
          const updateRes = await tx.reservation.updateMany({
            where: {
              id: reservation.id,
              propertyId,
              version: reservation.version,
              status: ReservationStatus.CONFIRMED,
            },
            data: {
              assignedRoomId: dto.roomId,
              assignedAt: now,
              assignedBy: actor.userId,
              version: { increment: 1 },
            },
          });

          if (updateRes.count === 0) {
            throw new ConflictException(
              `Optimistic concurrency conflict while assigning room to reservation '${reservation.confirmationNumber}'. Please retry.`,
            );
          }

          // D. Append immutable assignment audit log
          const action = isReassignment ? 'REASSIGN' : 'ASSIGN';
          await tx.reservationAssignmentLog.create({
            data: {
              id: generateUuidV7(),
              propertyId,
              reservationId: reservation.id,
              previousRoomId: prevRoomId || null,
              newRoomId: dto.roomId,
              action,
              reason: dto.reason || null,
              actorId: actor.userId,
              createdAt: now,
            },
          });

          // E. Emit ROOM_ASSIGNED CloudEvent to outbox
          const event = createCloudEvent({
            type: PmsEventType.ROOM_ASSIGNED,
            source: `https://pms.enterprise-hms.com/properties/${propertyId}/reservations/${reservation.id}`,
            subject: reservation.id,
            propertyId,
            data: {
              propertyId,
              reservationId: reservation.id,
              confirmationNumber: reservation.confirmationNumber,
              roomId: dto.roomId,
              roomNumber: targetRoom.roomNumber,
              actorId: actor.userId,
              assignedAt: now.toISOString(),
              previousRoomId: prevRoomId || null,
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

          return this.mapToReservationDto(updatedReservation);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10000,
        },
      );
    } catch (error: any) {
      if (isGiSTExclusionConflict(error)) {
        throw new ConflictException(
          `Target room '${targetRoom.roomNumber}' is already assigned to another active reservation for the requested stay window.`,
        );
      }
      throw error;
    }
  }

  /**
   * Unassigns a physical room from a confirmed reservation.
   */
  public async unassignRoom(
    propertyId: string,
    reservationId: string,
    dto: UnassignRoomDto,
    actor: SecurityContext,
  ): Promise<ReservationDto> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

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

    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new ConflictException(
        `Cannot unassign room from reservation with status '${reservation.status}'. Only CONFIRMED reservations can be unassigned.`,
      );
    }

    if (!reservation.assignedRoomId) {
      this.logger.log(
        `Reservation ${reservation.confirmationNumber} is already unassigned. NO-OP.`,
      );
      return this.mapToReservationDto(reservation);
    }

    const currentAssignedRoomId = reservation.assignedRoomId;

    return this.prisma.$transaction(
      async (tx) => {
        // Lock room row
        const currentR = await tx.room.findUniqueOrThrow({ where: { id: currentAssignedRoomId } });
        const bumpRes = await tx.room.updateMany({
          where: { id: currentAssignedRoomId, propertyId, version: currentR.version },
          data: { version: { increment: 1 } },
        });
        if (bumpRes.count === 0) {
          throw new ConflictException(
            `Optimistic concurrency conflict while unlocking room '${currentAssignedRoomId}'`,
          );
        }

        const now = new Date();
        const updateRes = await tx.reservation.updateMany({
          where: {
            id: reservation.id,
            propertyId,
            version: reservation.version,
            status: ReservationStatus.CONFIRMED,
          },
          data: {
            assignedRoomId: null,
            assignedAt: null,
            assignedBy: null,
            version: { increment: 1 },
          },
        });

        if (updateRes.count === 0) {
          throw new ConflictException(
            `Optimistic concurrency conflict while unassigning room from reservation '${reservation.confirmationNumber}'`,
          );
        }

        await tx.reservationAssignmentLog.create({
          data: {
            id: generateUuidV7(),
            propertyId,
            reservationId: reservation.id,
            previousRoomId: currentAssignedRoomId,
            newRoomId: null,
            action: 'UNASSIGN',
            reason: dto.reason || null,
            actorId: actor.userId,
            createdAt: now,
          },
        });

        const event = createCloudEvent({
          type: PmsEventType.ROOM_UNASSIGNED,
          source: `https://pms.enterprise-hms.com/properties/${propertyId}/reservations/${reservation.id}`,
          subject: reservation.id,
          propertyId,
          data: {
            propertyId,
            reservationId: reservation.id,
            confirmationNumber: reservation.confirmationNumber,
            previousRoomId: currentAssignedRoomId,
            actorId: actor.userId,
            unassignedAt: now.toISOString(),
            reason: dto.reason || null,
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

        return this.mapToReservationDto(updatedReservation);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );
  }

  /**
   * Retrieves historical assignment logs for a reservation.
   */
  public async getAssignmentLogs(
    propertyId: string,
    reservationId: string,
  ): Promise<{ items: ReservationAssignmentLogDto[]; total: number }> {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, propertyId, deletedAt: null },
    });
    if (!reservation) {
      throw new NotFoundException(
        `Reservation '${reservationId}' not found on property '${propertyId}'`,
      );
    }

    const [logs, total] = await Promise.all([
      this.prisma.reservationAssignmentLog.findMany({
        where: { propertyId, reservationId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reservationAssignmentLog.count({
        where: { propertyId, reservationId },
      }),
    ]);

    const items: ReservationAssignmentLogDto[] = logs.map((l) => ({
      id: l.id,
      propertyId: l.propertyId,
      reservationId: l.reservationId,
      previousRoomId: l.previousRoomId,
      newRoomId: l.newRoomId,
      action: l.action,
      reason: l.reason,
      actorId: l.actorId,
      createdAt: l.createdAt.toISOString(),
    }));

    return { items, total };
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
