import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import { RoomStatusService } from '../../room-operations/services/room-status.service';
import {
  CheckoutResponseDto,
  CheckoutSummaryItemDto,
  FolioStatus,
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

function computeCheckoutPayloadHash(): string {
  // Checkout has no request body; hash of empty string is deterministic canonical representation
  return crypto.createHash('sha256').update('').digest('hex');
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly roomStatusService: RoomStatusService,
  ) {}

  /**
   * Orchestrates the departure checkout of a checked-in reservation.
   * Enforces STRICT ZERO-BALANCE policy on all associated folios:
   *   balance > 0 -> 409 FOLIO_BALANCE_NON_ZERO
   *   balance < 0 -> 409 FOLIO_BALANCE_NON_ZERO (deferred business decision: guest credits not supported)
   *   balance = 0 -> ALLOW CHECKOUT
   */
  public async checkout(
    propertyId: string,
    reservationId: string,
    actor: SecurityContext,
    idempotencyKey: string,
  ): Promise<CheckoutResponseDto> {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required for processing checkout',
      });
    }

    const trimmedKey = idempotencyKey.trim();
    const payloadHash = computeCheckoutPayloadHash();

    // 1. Check idempotency: see if reservation was already checked out with this key
    const existingWithKey = await this.prisma.reservation.findUnique({
      where: {
        uq_reservations_checkout_idempotency: {
          propertyId,
          checkOutIdempotencyKey: trimmedKey,
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
      if (existingWithKey.id !== reservationId) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          errorCode: 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_ENTITY',
          message: `Idempotency key '${trimmedKey}' has already been used for another reservation in this property`,
        });
      }

      if (existingWithKey.checkOutPayloadHash !== payloadHash) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          message: `Idempotency key '${trimmedKey}' was already submitted with different checkout parameters`,
        });
      }

      this.logger.log(
        `Idempotent checkout request resolved for key '${trimmedKey}' on reservation ${existingWithKey.confirmationNumber}`,
      );

      const roomStatus = await this.roomStatusService.findById(
        propertyId,
        existingWithKey.assignedRoomId!,
      );

      const folios = await this.prisma.folio.findMany({
        where: { propertyId, reservationId: existingWithKey.id },
        include: { transactions: true, payments: true },
      });

      const summary: CheckoutSummaryItemDto[] = folios.map((f) => {
        const totalCharges = f.transactions.reduce(
          (acc, t) => acc.plus(new Prisma.Decimal(t.amount)),
          new Prisma.Decimal(0),
        );
        const totalPayments = f.payments.reduce(
          (acc, p) => acc.plus(new Prisma.Decimal(p.amount)),
          new Prisma.Decimal(0),
        );
        return {
          folioId: f.id,
          folioNumber: f.folioNumber,
          finalBalance: new Prisma.Decimal(f.balance).toFixed(4),
          totalCharges: totalCharges.toFixed(4),
          totalPayments: totalPayments.toFixed(4),
        };
      });

      return {
        reservation: this.mapToReservationDto(existingWithKey),
        room: roomStatus,
        checkOutAt: existingWithKey.checkOutAt!.toISOString(),
        checkedOutBy: existingWithKey.checkedOutBy || actor.userId,
        foliosSummary: summary,
      };
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

    if (reservation.status === ReservationStatus.CHECKED_OUT) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        errorCode: 'RESERVATION_ALREADY_CHECKED_OUT',
        message: `Reservation '${reservation.confirmationNumber}' is already in CHECKED_OUT status`,
      });
    }

    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'RESERVATION_NOT_CHECKED_IN',
        message: `Cannot check out reservation with status '${reservation.status}'. Only CHECKED_IN reservations can be checked out.`,
      });
    }

    if (!reservation.assignedRoomId) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'ROOM_NOT_ASSIGNED',
        message: `Reservation '${reservation.confirmationNumber}' has no assigned room to depart from.`,
      });
    }

    // 3. Pre-flight Folio balance verification: STRICT ZERO-BALANCE POLICY
    const openFolios = await this.prisma.folio.findMany({
      where: {
        propertyId,
        reservationId: reservation.id,
        status: FolioStatus.OPEN,
      },
      include: {
        transactions: true,
        payments: true,
      },
    });

    for (const folio of openFolios) {
      const sumCharges = folio.transactions.reduce(
        (acc, t) => acc.plus(new Prisma.Decimal(t.amount)),
        new Prisma.Decimal(0),
      );
      const sumPayments = folio.payments.reduce(
        (acc, p) => acc.plus(new Prisma.Decimal(p.amount)),
        new Prisma.Decimal(0),
      );
      const verifiedBalance = sumCharges.minus(sumPayments);

      // Verify materialized balance matches ledger recalculation
      const materialized = new Prisma.Decimal(folio.balance);
      if (!verifiedBalance.equals(materialized)) {
        this.logger.error(
          `Balance integrity violation on folio ${folio.folioNumber}: materialized ${materialized.toFixed(4)} !== recalculated ${verifiedBalance.toFixed(4)}`,
        );
        throw new InternalServerErrorException({
          statusCode: 500,
          error: 'Internal Server Error',
          errorCode: 'BALANCE_INTEGRITY_VIOLATION',
          message: `Data integrity error on folio '${folio.folioNumber}': balance discrepancy detected.`,
        });
      }

      // STRICT ZERO-BALANCE: Reject if > 0 or < 0
      if (!verifiedBalance.isZero()) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          errorCode: 'FOLIO_BALANCE_NON_ZERO',
          message: `Cannot check out: Folio '${folio.folioNumber}' has a non-zero balance of ${verifiedBalance.toFixed(4)} ${folio.currency}. All folios must be settled to exactly 0.00.`,
        });
      }
    }

    const assignedRoomId = reservation.assignedRoomId;
    const now = new Date();

    // 4. Execute Atomic Checkout Transaction
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const foliosSummary: CheckoutSummaryItemDto[] = [];

          // Phase A: Explicit OCC close on each open folio
          for (const folio of openFolios) {
            const updateFolioRes = await tx.folio.updateMany({
              where: {
                id: folio.id,
                version: folio.version,
                status: FolioStatus.OPEN,
              },
              data: {
                status: FolioStatus.CLOSED,
                closedAt: now,
                closedBy: actor.userId,
                version: { increment: 1 },
              },
            });

            if (updateFolioRes.count === 0) {
              throw new ConflictException({
                statusCode: 409,
                error: 'Conflict',
                errorCode: 'OCC_CONFLICT',
                message: `Optimistic concurrency conflict while closing folio '${folio.folioNumber}'. A concurrent transaction altered the folio. Please retry checkout.`,
              });
            }

            const totalCharges = folio.transactions.reduce(
              (acc, t) => acc.plus(new Prisma.Decimal(t.amount)),
              new Prisma.Decimal(0),
            );
            const totalPayments = folio.payments.reduce(
              (acc, p) => acc.plus(new Prisma.Decimal(p.amount)),
              new Prisma.Decimal(0),
            );

            foliosSummary.push({
              folioId: folio.id,
              folioNumber: folio.folioNumber,
              finalBalance: new Prisma.Decimal(0).toFixed(4),
              totalCharges: totalCharges.toFixed(4),
              totalPayments: totalPayments.toFixed(4),
            });

            // Emit FOLIO_CLOSED event
            const folioEvent = createCloudEvent({
              type: PmsEventType.FOLIO_CLOSED,
              source: `https://pms.enterprise-hms.com/properties/${propertyId}/folios/${folio.id}`,
              subject: folio.id,
              propertyId,
              data: {
                propertyId,
                folioId: folio.id,
                reservationId: reservation.id,
                folioNumber: folio.folioNumber,
                finalBalance: 0,
                closedAt: now.toISOString(),
                closedBy: actor.userId,
              },
            });

            await tx.outboxEvent.create({
              data: {
                id: folioEvent.id,
                specversion: folioEvent.specversion,
                type: folioEvent.type,
                source: folioEvent.source,
                subject: folioEvent.subject,
                propertyId,
                datacontenttype: folioEvent.datacontenttype,
                time: new Date(folioEvent.time),
                data: folioEvent.data as any,
                correlationId: folioEvent.correlationid,
                causationId: folioEvent.causationid,
              },
            });
          }

          // Phase B: Update Reservation status to CHECKED_OUT with OCC version check
          const updateRes = await tx.reservation.updateMany({
            where: {
              id: reservation.id,
              propertyId,
              version: reservation.version,
              status: ReservationStatus.CHECKED_IN,
            },
            data: {
              status: ReservationStatus.CHECKED_OUT,
              checkOutAt: now,
              checkedOutBy: actor.userId,
              checkOutIdempotencyKey: trimmedKey,
              checkOutPayloadHash: payloadHash,
              version: { increment: 1 },
            },
          });

          if (updateRes.count === 0) {
            throw new ConflictException({
              statusCode: 409,
              error: 'Conflict',
              errorCode: 'OCC_CONFLICT',
              message: `Optimistic concurrency conflict while checking out reservation '${reservation.confirmationNumber}'. Please retry.`,
            });
          }

          // Phase C: Controlled T06 departRoom invocation
          const departed = await this.roomStatusService.departRoom(
            propertyId,
            assignedRoomId,
            {
              actorId: actor.userId,
              reason: 'Guest Checkout Departure',
            },
            tx,
          );

          // Phase D: Emit GUEST_CHECKED_OUT CloudEvent
          const guestEvent = createCloudEvent({
            type: PmsEventType.GUEST_CHECKED_OUT,
            source: `https://pms.enterprise-hms.com/properties/${propertyId}/reservations/${reservation.id}`,
            subject: reservation.id,
            propertyId,
            data: {
              propertyId,
              reservationId: reservation.id,
              confirmationNumber: reservation.confirmationNumber,
              guestId: reservation.guestId,
              roomId: assignedRoomId,
              roomNumber: departed.room.roomNumber,
              checkOutAt: now.toISOString(),
              actorId: actor.userId,
            },
          });

          await tx.outboxEvent.create({
            data: {
              id: guestEvent.id,
              specversion: guestEvent.specversion,
              type: guestEvent.type,
              source: guestEvent.source,
              subject: guestEvent.subject,
              propertyId,
              datacontenttype: guestEvent.datacontenttype,
              time: new Date(guestEvent.time),
              data: guestEvent.data as any,
              correlationId: guestEvent.correlationid,
              causationId: guestEvent.causationid,
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
            roomId: departed.room.id,
            propertyId: departed.room.propertyId,
            roomNumber: departed.room.roomNumber,
            roomTypeId: departed.room.roomTypeId,
            housekeepingStatus: departed.room.housekeepingStatus as HousekeepingStatus,
            serviceStatus: departed.room.serviceStatus as RoomServiceStatus,
            occupancyStatus: departed.room.occupancyStatus as RoomOccupancyStatus,
            version: departed.room.version,
            effective: departed.effective,
          };

          this.logger.log(
            `Reservation ${reservation.confirmationNumber} checked out successfully by ${actor.userId}`,
          );

          return {
            reservation: this.mapToReservationDto(updatedReservation),
            room: roomDto,
            checkOutAt: now.toISOString(),
            checkedOutBy: actor.userId,
            foliosSummary,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 15000,
        },
      );
    } catch (error: any) {
      if (
        error.code === 'P2002' ||
        error.message?.includes('uq_reservations_checkout_idempotency')
      ) {
        let committedWithKey = await this.prisma.reservation.findUnique({
          where: {
            uq_reservations_checkout_idempotency: {
              propertyId,
              checkOutIdempotencyKey: trimmedKey,
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
          await new Promise((resolve) => setTimeout(resolve, 150));
          committedWithKey = await this.prisma.reservation.findUnique({
            where: {
              uq_reservations_checkout_idempotency: {
                propertyId,
                checkOutIdempotencyKey: trimmedKey,
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
              message: `Idempotency key '${trimmedKey}' has already been used for another reservation in this property`,
            });
          }

          if (committedWithKey.checkOutPayloadHash !== payloadHash) {
            throw new ConflictException({
              statusCode: 409,
              error: 'Conflict',
              errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
              message: `Idempotency key '${trimmedKey}' was already submitted with different checkout parameters`,
            });
          }

          const roomStatus = await this.roomStatusService.findById(
            propertyId,
            committedWithKey.assignedRoomId!,
          );

          const folios = await this.prisma.folio.findMany({
            where: { propertyId, reservationId: committedWithKey.id },
            include: { transactions: true, payments: true },
          });

          const summary: CheckoutSummaryItemDto[] = folios.map((f) => {
            const totalCharges = f.transactions.reduce(
              (acc, t) => acc.plus(new Prisma.Decimal(t.amount)),
              new Prisma.Decimal(0),
            );
            const totalPayments = f.payments.reduce(
              (acc, p) => acc.plus(new Prisma.Decimal(p.amount)),
              new Prisma.Decimal(0),
            );
            return {
              folioId: f.id,
              folioNumber: f.folioNumber,
              finalBalance: new Prisma.Decimal(f.balance).toFixed(4),
              totalCharges: totalCharges.toFixed(4),
              totalPayments: totalPayments.toFixed(4),
            };
          });

          return {
            reservation: this.mapToReservationDto(committedWithKey),
            room: roomStatus,
            checkOutAt: committedWithKey.checkOutAt!.toISOString(),
            checkedOutBy: committedWithKey.checkedOutBy || actor.userId,
            foliosSummary: summary,
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
            createdAt: res.guest.createdAt
              ? res.guest.createdAt.toISOString()
              : new Date().toISOString(),
            updatedAt: res.guest.updatedAt
              ? res.guest.updatedAt.toISOString()
              : new Date().toISOString(),
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
