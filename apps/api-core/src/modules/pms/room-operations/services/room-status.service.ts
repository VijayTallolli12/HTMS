import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PropertyBusinessDateService } from '../../common/services/property-business-date.service';
import { RoomStatusReconciliationService } from './room-status-reconciliation.service';
import { UpdateRoomStatusDto } from '../dto/update-room-status.dto';
import {
  HousekeepingStatus,
  PmsEventType,
  QueryRoomStatusDto,
  RoomOccupancyStatus,
  RoomServiceStatus,
  RoomStatusDto,
  RoomStatusLogDto,
  RoomStatusLogSource,
} from '@hms/api-contracts';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';

@Injectable()
export class RoomStatusService {
  private readonly logger = new Logger(RoomStatusService.name);

  // Authoritative Housekeeping State Transition Rules
  private readonly validTransitions: Record<HousekeepingStatus, HousekeepingStatus[]> = {
    [HousekeepingStatus.DIRTY]: [HousekeepingStatus.CLEANING, HousekeepingStatus.CLEAN],
    [HousekeepingStatus.CLEANING]: [HousekeepingStatus.CLEAN, HousekeepingStatus.DIRTY],
    [HousekeepingStatus.CLEAN]: [
      HousekeepingStatus.INSPECTED,
      HousekeepingStatus.PICKUP,
      HousekeepingStatus.DIRTY,
    ],
    [HousekeepingStatus.INSPECTED]: [HousekeepingStatus.DIRTY, HousekeepingStatus.PICKUP],
    [HousekeepingStatus.PICKUP]: [
      HousekeepingStatus.CLEANING,
      HousekeepingStatus.CLEAN,
      HousekeepingStatus.INSPECTED,
      HousekeepingStatus.DIRTY,
    ],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly businessDateService: PropertyBusinessDateService,
    private readonly reconciliationService: RoomStatusReconciliationService,
  ) {}

  public async findAll(propertyId: string, filters?: QueryRoomStatusDto): Promise<RoomStatusDto[]> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

    const currentBusinessDate = this.businessDateService.getCurrentBusinessDate(property.timeZone);

    const rooms = await this.prisma.room.findMany({
      where: {
        propertyId,
        deletedAt: null,
        ...(filters?.buildingId ? { buildingId: filters.buildingId } : {}),
        ...(filters?.floorId ? { floorId: filters.floorId } : {}),
        ...(filters?.roomTypeId ? { roomTypeId: filters.roomTypeId } : {}),
        ...(filters?.housekeepingStatus ? { housekeepingStatus: filters.housekeepingStatus } : {}),
        ...(filters?.serviceStatus ? { serviceStatus: filters.serviceStatus } : {}),
      },
      orderBy: { roomNumber: 'asc' },
    });

    const results: RoomStatusDto[] = [];
    for (const room of rooms) {
      const reconciled = await this.reconciliationService.reconcileRoom(
        propertyId,
        room,
        currentBusinessDate,
      );

      const activeBlock = await this.prisma.roomMaintenanceBlock.findFirst({
        where: {
          propertyId,
          roomId: reconciled.id,
          status: 'ACTIVE',
          deletedAt: null,
          startDate: { lte: currentBusinessDate },
          endDate: { gt: currentBusinessDate },
        },
      });

      const effective = this.reconciliationService.resolveEffectiveState(
        reconciled,
        activeBlock,
        currentBusinessDate,
      );

      results.push(this.mapToDto(reconciled, effective));
    }

    return results;
  }

  public async findById(propertyId: string, roomId: string): Promise<RoomStatusDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

    const room = await this.prisma.room.findFirst({
      where: { id: roomId, propertyId, deletedAt: null },
    });
    if (!room) {
      throw new NotFoundException(`Room '${roomId}' not found on property '${propertyId}'`);
    }

    const currentBusinessDate = this.businessDateService.getCurrentBusinessDate(property.timeZone);
    const reconciled = await this.reconciliationService.reconcileRoom(
      propertyId,
      room,
      currentBusinessDate,
    );

    const activeBlock = await this.prisma.roomMaintenanceBlock.findFirst({
      where: {
        propertyId,
        roomId: reconciled.id,
        status: 'ACTIVE',
        deletedAt: null,
        startDate: { lte: currentBusinessDate },
        endDate: { gt: currentBusinessDate },
      },
    });

    const effective = this.reconciliationService.resolveEffectiveState(
      reconciled,
      activeBlock,
      currentBusinessDate,
    );

    return this.mapToDto(reconciled, effective);
  }

  public async updateHousekeepingStatus(
    propertyId: string,
    roomId: string,
    dto: UpdateRoomStatusDto,
    userId: string,
  ): Promise<RoomStatusDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

    const currentBusinessDate = this.businessDateService.getCurrentBusinessDate(property.timeZone);

    return this.prisma.$transaction(
      async (tx) => {
        const room = await tx.room.findFirst({
          where: { id: roomId, propertyId, deletedAt: null },
        });
        if (!room) {
          throw new NotFoundException(`Room '${roomId}' not found on property '${propertyId}'`);
        }

        // Reconcile complete projection first inside tx
        const reconciled = await this.reconciliationService.reconcileRoom(
          propertyId,
          room,
          currentBusinessDate,
          tx,
        );

        const currentHK = reconciled.housekeepingStatus as HousekeepingStatus;
        const targetHK = dto.housekeepingStatus;

        // Idempotent if already in target status
        if (currentHK === targetHK) {
          const activeBlock = await tx.roomMaintenanceBlock.findFirst({
            where: {
              propertyId,
              roomId: reconciled.id,
              status: 'ACTIVE',
              deletedAt: null,
              startDate: { lte: currentBusinessDate },
              endDate: { gt: currentBusinessDate },
            },
          });
          const effective = this.reconciliationService.resolveEffectiveState(
            reconciled,
            activeBlock,
            currentBusinessDate,
          );
          return this.mapToDto(reconciled, effective);
        }

        // Validate state transition rule
        const allowed = this.validTransitions[currentHK] || [];
        if (!allowed.includes(targetHK)) {
          throw new BadRequestException(
            `Invalid housekeeping status transition from '${currentHK}' to '${targetHK}'. Allowed next states: [${allowed.join(', ')}]`,
          );
        }

        // Apply OCC update on Room
        const res = await tx.room.updateMany({
          where: {
            id: reconciled.id,
            propertyId,
            version: reconciled.version,
          },
          data: {
            housekeepingStatus: targetHK,
            version: { increment: 1 },
          },
        });

        if (res.count === 0) {
          throw new ConflictException(
            `Optimistic concurrency conflict while updating room '${reconciled.roomNumber}' status`,
          );
        }

        const updatedRoom = await tx.room.findUniqueOrThrow({
          where: { id: reconciled.id },
        });

        // Insert immutable audit log
        await tx.roomStatusLog.create({
          data: {
            id: generateUuidV7(),
            propertyId,
            roomId: updatedRoom.id,
            previousHousekeepingStatus: currentHK,
            newHousekeepingStatus: targetHK,
            previousServiceStatus: updatedRoom.serviceStatus,
            newServiceStatus: updatedRoom.serviceStatus,
            reason: dto.reason || null,
            source: RoomStatusLogSource.MANUAL,
            changedBy: userId,
          },
        });

        // Emit CloudEvent
        const event = createCloudEvent({
          type: PmsEventType.ROOM_STATUS_CHANGED,
          source: `https://pms.enterprise-hms.com/properties/${propertyId}/rooms/${updatedRoom.id}`,
          subject: updatedRoom.id,
          propertyId,
          data: {
            propertyId,
            roomId: updatedRoom.id,
            roomNumber: updatedRoom.roomNumber,
            previousHousekeepingStatus: currentHK,
            newHousekeepingStatus: targetHK,
            previousServiceStatus: updatedRoom.serviceStatus,
            newServiceStatus: updatedRoom.serviceStatus,
            reason: dto.reason || null,
            source: RoomStatusLogSource.MANUAL,
            updatedBy: userId,
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

        this.logger.log(
          `Room ${updatedRoom.roomNumber} housekeeping status changed: ${currentHK} -> ${targetHK} by user ${userId}`,
        );

        const activeBlock = await tx.roomMaintenanceBlock.findFirst({
          where: {
            propertyId,
            roomId: updatedRoom.id,
            status: 'ACTIVE',
            deletedAt: null,
            startDate: { lte: currentBusinessDate },
            endDate: { gt: currentBusinessDate },
          },
        });

        const effective = this.reconciliationService.resolveEffectiveState(
          updatedRoom,
          activeBlock,
          currentBusinessDate,
        );

        return this.mapToDto(updatedRoom, effective);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );
  }

  public async getStatusHistory(
    propertyId: string,
    roomId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ items: RoomStatusLogDto[]; total: number; page: number; limit: number }> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

    const room = await this.prisma.room.findFirst({
      where: { id: roomId, propertyId, deletedAt: null },
    });
    if (!room) {
      throw new NotFoundException(`Room '${roomId}' not found on property '${propertyId}'`);
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [logs, total] = await Promise.all([
      this.prisma.roomStatusLog.findMany({
        where: { propertyId, roomId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.roomStatusLog.count({
        where: { propertyId, roomId },
      }),
    ]);

    const items: RoomStatusLogDto[] = logs.map((l) => ({
      id: l.id,
      propertyId: l.propertyId,
      roomId: l.roomId,
      previousHousekeepingStatus: l.previousHousekeepingStatus,
      newHousekeepingStatus: l.newHousekeepingStatus,
      previousServiceStatus: l.previousServiceStatus,
      newServiceStatus: l.newServiceStatus,
      reason: l.reason,
      source: l.source,
      changedBy: l.changedBy,
      createdAt: l.createdAt.toISOString(),
    }));

    return { items, total, page: safePage, limit: safeLimit };
  }

  private mapToDto(
    room: Prisma.RoomGetPayload<object>,
    effective: RoomStatusDto['effective'],
  ): RoomStatusDto {
    return {
      roomId: room.id,
      propertyId: room.propertyId,
      roomNumber: room.roomNumber,
      roomTypeId: room.roomTypeId,
      housekeepingStatus: room.housekeepingStatus as HousekeepingStatus,
      serviceStatus: room.serviceStatus as RoomServiceStatus,
      occupancyStatus: room.occupancyStatus as RoomOccupancyStatus,
      version: room.version,
      effective,
    };
  }
}
