import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Room } from '@prisma/client';
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

  public async occupyRoom(
    propertyId: string,
    roomId: string,
    options: {
      allowCleanOverride?: boolean;
      actorId: string;
      reason?: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<{ room: Room; effective: RoomStatusDto['effective'] }> {
    const client = tx;

    const property = await client.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

    const currentBusinessDate = this.businessDateService.getCurrentBusinessDate(property.timeZone);

    const room = await client.room.findFirst({
      where: { id: roomId, propertyId, deletedAt: null },
    });
    if (!room) {
      throw new NotFoundException(`Room '${roomId}' not found on property '${propertyId}'`);
    }

    // 1. Reconcile room projection using T06 reconciliation service inside tx
    const reconciled = await this.reconciliationService.reconcileRoom(
      propertyId,
      room,
      currentBusinessDate,
      client,
    );

    // 2. Fetch active maintenance block covering current business date
    const activeBlock = await client.roomMaintenanceBlock.findFirst({
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

    // 3. Operational readiness checks
    if (effective.serviceStatus !== RoomServiceStatus.IN_SERVICE || activeBlock) {
      throw new ConflictException(
        `Room '${reconciled.roomNumber}' is ${effective.serviceStatus} and cannot be checked in`,
      );
    }

    if (reconciled.occupancyStatus !== RoomOccupancyStatus.VACANT) {
      throw new ConflictException(
        `Room '${reconciled.roomNumber}' is already ${reconciled.occupancyStatus}`,
      );
    }

    const currentHK = reconciled.housekeepingStatus as HousekeepingStatus;
    const isInspected = currentHK === HousekeepingStatus.INSPECTED;
    const isCleanWithOverride =
      currentHK === HousekeepingStatus.CLEAN && options.allowCleanOverride;

    if (!isInspected && !isCleanWithOverride) {
      if (currentHK === HousekeepingStatus.CLEAN) {
        throw new ConflictException(
          `Room '${reconciled.roomNumber}' is CLEAN but requires supervisor override to check in`,
        );
      }
      throw new ConflictException(
        `Room '${reconciled.roomNumber}' is in '${currentHK}' status and not ready for check-in`,
      );
    }

    // 4. Atomically mutate room occupancyStatus = 'OCCUPIED' with OCC
    const updateRes = await client.room.updateMany({
      where: {
        id: reconciled.id,
        propertyId,
        version: reconciled.version,
        occupancyStatus: RoomOccupancyStatus.VACANT,
        serviceStatus: RoomServiceStatus.IN_SERVICE,
      },
      data: {
        occupancyStatus: RoomOccupancyStatus.OCCUPIED,
        version: { increment: 1 },
      },
    });

    if (updateRes.count === 0) {
      throw new ConflictException(
        `Optimistic concurrency conflict while occupying room '${reconciled.roomNumber}'`,
      );
    }

    const updatedRoom = await client.room.findUniqueOrThrow({
      where: { id: reconciled.id },
    });

    // 5. Append RoomStatusLog (source = CHECK_IN)
    await client.roomStatusLog.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        roomId: updatedRoom.id,
        previousHousekeepingStatus: currentHK,
        newHousekeepingStatus: currentHK,
        previousServiceStatus: updatedRoom.serviceStatus,
        newServiceStatus: updatedRoom.serviceStatus,
        reason: options.reason || 'Guest Check-In',
        source: 'CHECK_IN',
        changedBy: options.actorId,
      },
    });

    // 6. Emit CloudEvent ROOM_OCCUPANCY_CHANGED
    const occEvent = createCloudEvent({
      type: PmsEventType.ROOM_OCCUPANCY_CHANGED,
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/rooms/${updatedRoom.id}`,
      subject: updatedRoom.id,
      propertyId,
      data: {
        propertyId,
        roomId: updatedRoom.id,
        roomNumber: updatedRoom.roomNumber,
        previousOccupancyStatus: RoomOccupancyStatus.VACANT,
        newOccupancyStatus: RoomOccupancyStatus.OCCUPIED,
        source: 'CHECK_IN',
        actorId: options.actorId,
        timestamp: new Date().toISOString(),
      },
    });

    await client.outboxEvent.create({
      data: {
        id: occEvent.id,
        specversion: occEvent.specversion,
        type: occEvent.type,
        source: occEvent.source,
        subject: occEvent.subject,
        propertyId,
        datacontenttype: occEvent.datacontenttype,
        time: new Date(occEvent.time),
        data: occEvent.data as any,
        correlationId: occEvent.correlationid,
        causationId: occEvent.causationid,
      },
    });

    const updatedEffective = this.reconciliationService.resolveEffectiveState(
      updatedRoom,
      null,
      currentBusinessDate,
    );

    return { room: updatedRoom, effective: updatedEffective };
  }

  /**
   * Controlled departure transition invoked exclusively during checkout orchestration.
   * Mutates room occupancyStatus to VACANT and housekeepingStatus to DIRTY.
   * If already VACANT, behaves idempotently.
   */
  public async departRoom(
    propertyId: string,
    roomId: string,
    options: {
      actorId: string;
      reason?: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<{ room: Room; effective: RoomStatusDto['effective'] }> {
    const client = tx;

    const property = await client.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

    const currentBusinessDate = this.businessDateService.getCurrentBusinessDate(property.timeZone);

    const room = await client.room.findFirst({
      where: { id: roomId, propertyId, deletedAt: null },
    });
    if (!room) {
      throw new NotFoundException(`Room '${roomId}' not found on property '${propertyId}'`);
    }

    // 1. Reconcile room projection using T06 reconciliation service inside tx
    const reconciled = await this.reconciliationService.reconcileRoom(
      propertyId,
      room,
      currentBusinessDate,
      client,
    );

    // Idempotent: if already VACANT, return current state
    if (reconciled.occupancyStatus === RoomOccupancyStatus.VACANT) {
      const activeBlock = await client.roomMaintenanceBlock.findFirst({
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
      return { room: reconciled, effective };
    }

    const currentHK = reconciled.housekeepingStatus as HousekeepingStatus;
    const targetHK = HousekeepingStatus.DIRTY;

    // 2. Atomically mutate room occupancyStatus = 'VACANT' and housekeepingStatus = 'DIRTY' with OCC
    const updateRes = await client.room.updateMany({
      where: {
        id: reconciled.id,
        propertyId,
        version: reconciled.version,
        occupancyStatus: RoomOccupancyStatus.OCCUPIED,
      },
      data: {
        occupancyStatus: RoomOccupancyStatus.VACANT,
        housekeepingStatus: targetHK,
        version: { increment: 1 },
      },
    });

    if (updateRes.count === 0) {
      throw new ConflictException(
        `Optimistic concurrency conflict while departing room '${reconciled.roomNumber}'`,
      );
    }

    const updatedRoom = await client.room.findUniqueOrThrow({
      where: { id: reconciled.id },
    });

    // 3. Append RoomStatusLog (source = CHECKOUT)
    await client.roomStatusLog.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        roomId: updatedRoom.id,
        previousHousekeepingStatus: currentHK,
        newHousekeepingStatus: targetHK,
        previousServiceStatus: updatedRoom.serviceStatus,
        newServiceStatus: updatedRoom.serviceStatus,
        reason: options.reason || 'Guest Checkout Departure',
        source: 'CHECKOUT',
        changedBy: options.actorId,
      },
    });

    // 4. Emit CloudEvent ROOM_OCCUPANCY_CHANGED
    const occEvent = createCloudEvent({
      type: PmsEventType.ROOM_OCCUPANCY_CHANGED,
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/rooms/${updatedRoom.id}`,
      subject: updatedRoom.id,
      propertyId,
      data: {
        propertyId,
        roomId: updatedRoom.id,
        roomNumber: updatedRoom.roomNumber,
        previousOccupancyStatus: RoomOccupancyStatus.OCCUPIED,
        newOccupancyStatus: RoomOccupancyStatus.VACANT,
        source: 'CHECKOUT',
        actorId: options.actorId,
        timestamp: new Date().toISOString(),
      },
    });

    await client.outboxEvent.create({
      data: {
        id: occEvent.id,
        specversion: occEvent.specversion,
        type: occEvent.type,
        source: occEvent.source,
        subject: occEvent.subject,
        propertyId,
        datacontenttype: occEvent.datacontenttype,
        time: new Date(occEvent.time),
        data: occEvent.data as any,
        correlationId: occEvent.correlationid,
        causationId: occEvent.causationid,
      },
    });

    this.logger.log(
      `Room ${updatedRoom.roomNumber} departed: OCCUPIED -> VACANT, ${currentHK} -> DIRTY by actor ${options.actorId}`,
    );

    const activeBlock = await client.roomMaintenanceBlock.findFirst({
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

    return { room: updatedRoom, effective };
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
