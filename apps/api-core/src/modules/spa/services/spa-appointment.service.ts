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
  SpaAppointmentDto,
  SpaAppointmentStatus,
  SecurityContext,
} from '@hms/api-contracts';
import { FolioService } from '../../pms/finance/services/folio.service';
import {
  CreateSpaAppointmentDto,
  UpdateSpaAppointmentStatusDto,
  CompleteSpaAppointmentDto,
  QuerySpaAppointmentsDto,
} from '../dto/spa.dto';

@Injectable()
export class SpaAppointmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly folioService: FolioService,
  ) {}

  // ==========================================
  // APPOINTMENT CREATION
  // ==========================================
  async createAppointment(
    propertyId: string,
    dto: CreateSpaAppointmentDto,
    userId: string,
  ): Promise<SpaAppointmentDto> {
    const service = await this.prisma.spaService.findFirst({
      where: { id: dto.serviceId, propertyId, isActive: true },
    });
    if (!service) {
      throw new NotFoundException(`Active Spa Service '${dto.serviceId}' not found`);
    }

    const therapist = await this.prisma.spaTherapist.findFirst({
      where: { id: dto.therapistId, propertyId, isActive: true },
    });
    if (!therapist) {
      throw new NotFoundException(`Active Spa Therapist '${dto.therapistId}' not found`);
    }

    const room = await this.prisma.spaRoom.findFirst({
      where: { id: dto.roomId, propertyId, status: 'AVAILABLE' },
    });
    if (!room) {
      throw new NotFoundException(`Available Spa Treatment Room '${dto.roomId}' not found`);
    }

    const startTime = new Date(dto.startTime);
    if (isNaN(startTime.getTime())) {
      throw new BadRequestException('Invalid start time provided');
    }

    const durationMinutes = service.durationMinutes;
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    // Overlapping schedule conflict checks
    await this.checkSchedulingConflicts(
      propertyId,
      dto.therapistId,
      dto.roomId,
      startTime,
      endTime,
    );

    let resolvedRoomNumber: string | null = dto.roomNumber?.trim() || null;
    let resolvedGuestName: string | null = dto.guestName?.trim() || null;
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
    const appointmentNumber = `SPA-${datePrefix}-${seq}`;

    const created = await this.prisma.spaAppointment.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        appointmentNumber,
        serviceId: service.id,
        therapistId: therapist.id,
        roomId: room.id,
        startTime,
        endTime,
        durationMinutes,
        price: service.price,
        currency: service.currency,
        status: 'SCHEDULED',
        guestName: resolvedGuestName,
        guestPhone: dto.guestPhone?.trim(),
        roomNumber: resolvedRoomNumber,
        reservationId: resolvedReservationId,
        notes: dto.notes?.trim(),
        version: 1,
      },
      include: {
        service: true,
        therapist: true,
        room: true,
      },
    });

    return this.mapToDto(created);
  }

  // ==========================================
  // QUERY APPOINTMENTS
  // ==========================================
  async getAppointments(
    propertyId: string,
    query: QuerySpaAppointmentsDto,
  ): Promise<SpaAppointmentDto[]> {
    const where: any = { propertyId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.therapistId) {
      where.therapistId = query.therapistId;
    }

    if (query.roomId) {
      where.roomId = query.roomId;
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

    const appointments = await this.prisma.spaAppointment.findMany({
      where,
      include: {
        service: true,
        therapist: true,
        room: true,
      },
      orderBy: { startTime: 'asc' },
    });

    return appointments.map(this.mapToDto);
  }

  async getAppointment(
    propertyId: string,
    appointmentId: string,
  ): Promise<SpaAppointmentDto> {
    const appointment = await this.prisma.spaAppointment.findFirst({
      where: { id: appointmentId, propertyId },
      include: {
        service: true,
        therapist: true,
        room: true,
      },
    });
    if (!appointment) {
      throw new NotFoundException(`Spa Appointment '${appointmentId}' not found`);
    }

    return this.mapToDto(appointment);
  }

  // ==========================================
  // STATUS TRANSITION
  // ==========================================
  async updateAppointmentStatus(
    propertyId: string,
    appointmentId: string,
    dto: UpdateSpaAppointmentStatusDto,
    userId: string,
  ): Promise<SpaAppointmentDto> {
    const appointment = await this.prisma.spaAppointment.findFirst({
      where: { id: appointmentId, propertyId },
      include: { service: true, therapist: true, room: true },
    });
    if (!appointment) {
      throw new NotFoundException(`Spa Appointment '${appointmentId}' not found`);
    }

    const currentStatus = appointment.status;
    const targetStatus = dto.status;

    const validTransitions: Record<string, string[]> = {
      SCHEDULED: ['CONFIRMED', 'CANCELLED'],
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

    const updated = await this.prisma.spaAppointment.update({
      where: { id: appointmentId },
      data: {
        status: targetStatus,
        version: { increment: 1 },
      },
      include: {
        service: true,
        therapist: true,
        room: true,
      },
    });

    return this.mapToDto(updated);
  }

  // ==========================================
  // COMPLETE & POST TO FOLIO
  // ==========================================
  async completeAppointment(
    propertyId: string,
    appointmentId: string,
    dto: CompleteSpaAppointmentDto,
    actor: SecurityContext,
  ): Promise<SpaAppointmentDto> {
    const appointment = await this.prisma.spaAppointment.findFirst({
      where: { id: appointmentId, propertyId },
      include: { service: true, therapist: true, room: true },
    });
    if (!appointment) {
      throw new NotFoundException(`Spa Appointment '${appointmentId}' not found`);
    }

    if (appointment.status === 'COMPLETED') {
      return this.mapToDto(appointment);
    }
    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('Cannot complete a cancelled appointment');
    }

    let resolvedFolioId: string | null = null;
    let resolvedReservationId: string | null = dto.reservationId || appointment.reservationId || null;
    let resolvedRoomNumber: string | null = dto.roomNumber || appointment.roomNumber || null;
    let resolvedGuestName: string | null = appointment.guestName || null;
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
      } else if (dto.roomNumber || appointment.roomNumber) {
        const rNum = (dto.roomNumber || appointment.roomNumber)!.trim();
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
      } else if (dto.reservationId || appointment.reservationId) {
        const resId = dto.reservationId || appointment.reservationId!;
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
      const chargeDescription = `Spa Treatment - ${appointment.service.name} (${appointment.therapist.name}) [Appt #${appointment.appointmentNumber}]`;
      const idempotencyKey = `spa_appointment_complete_${appointment.id}`;

      const txResult = await this.folioService.postCharge(
        propertyId,
        resolvedFolioId!,
        {
          transactionCode: 'SPA',
          description: chargeDescription,
          amount: appointment.price.toFixed(2),
        },
        actor,
        idempotencyKey,
      );

      resolvedTransactionId = txResult.id;
    }

    const updated = await this.prisma.spaAppointment.update({
      where: { id: appointmentId },
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
        guestName: resolvedGuestName,
        completedAt: new Date(),
        completedBy: actor.userId,
        version: { increment: 1 },
      },
      include: {
        service: true,
        therapist: true,
        room: true,
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
  private async checkSchedulingConflicts(
    propertyId: string,
    therapistId: string,
    roomId: string,
    startTime: Date,
    endTime: Date,
    excludeAppointmentId?: string,
  ): Promise<void> {
    // 1. Therapist conflict
    const therapistConflict = await this.prisma.spaAppointment.findFirst({
      where: {
        propertyId,
        therapistId,
        status: { notIn: ['CANCELLED'] },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      include: { therapist: true },
    });

    if (therapistConflict) {
      const thName = therapistConflict.therapist?.name || 'The requested therapist';
      const apptNum = therapistConflict.appointmentNumber || 'existing';
      const sTime = therapistConflict.startTime?.toISOString ? therapistConflict.startTime.toISOString() : '';
      const eTime = therapistConflict.endTime?.toISOString ? therapistConflict.endTime.toISOString() : '';
      throw new ConflictException(
        `Therapist ${thName} already has an overlapping appointment (#${apptNum}) from ${sTime} to ${eTime}`,
      );
    }

    // 2. Room conflict
    const roomConflict = await this.prisma.spaAppointment.findFirst({
      where: {
        propertyId,
        roomId,
        status: { notIn: ['CANCELLED'] },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      include: { room: true },
    });

    if (roomConflict) {
      const rmName = roomConflict.room?.name || 'The requested room';
      const apptNum = roomConflict.appointmentNumber || 'existing';
      const sTime = roomConflict.startTime?.toISOString ? roomConflict.startTime.toISOString() : '';
      const eTime = roomConflict.endTime?.toISOString ? roomConflict.endTime.toISOString() : '';
      throw new ConflictException(
        `Spa Treatment Room '${rmName}' already has an overlapping appointment (#${apptNum}) from ${sTime} to ${eTime}`,
      );
    }
  }

  // ==========================================
  // MAPPER
  // ==========================================
  private mapToDto(a: any): SpaAppointmentDto {
    return {
      id: a.id,
      propertyId: a.propertyId,
      appointmentNumber: a.appointmentNumber,
      serviceId: a.serviceId,
      serviceName: a.service?.name,
      therapistId: a.therapistId,
      therapistName: a.therapist?.name,
      roomId: a.roomId,
      roomName: a.room?.name,
      startTime: a.startTime?.toISOString ? a.startTime.toISOString() : (a.startTime || new Date().toISOString()),
      endTime: a.endTime?.toISOString ? a.endTime.toISOString() : (a.endTime || new Date().toISOString()),
      durationMinutes: a.durationMinutes,
      price: a.price ? (typeof a.price === 'string' ? a.price : a.price.toFixed(2)) : '0.00',
      currency: a.currency,
      status: a.status as any,
      guestName: a.guestName,
      guestPhone: a.guestPhone,
      roomNumber: a.roomNumber,
      reservationId: a.reservationId,
      folioId: a.folioId,
      folioTransactionId: a.folioTransactionId,
      settlementType: a.settlementType as any,
      paymentMethod: a.paymentMethod as any,
      notes: a.notes,
      completedAt: a.completedAt ? (a.completedAt.toISOString ? a.completedAt.toISOString() : String(a.completedAt)) : null,
      completedBy: a.completedBy,
      version: a.version ?? 1,
      createdAt: a.createdAt?.toISOString ? a.createdAt.toISOString() : (a.createdAt || new Date().toISOString()),
      updatedAt: a.updatedAt?.toISOString ? a.updatedAt.toISOString() : (a.updatedAt || new Date().toISOString()),
    };
  }
}
