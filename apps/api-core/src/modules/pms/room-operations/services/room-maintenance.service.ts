import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoomMaintenanceBlock } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import { InventoryService } from '../../inventory/services/inventory.service';
import { PropertyBusinessDateService } from '../../common/services/property-business-date.service';
import { CreateMaintenanceBlockDto } from '../dto/create-maintenance-block.dto';
import { CancelMaintenanceBlockDto } from '../dto/cancel-maintenance-block.dto';
import { ReplaceMaintenanceBlockDto } from '../dto/replace-maintenance-block.dto';
import {
  HousekeepingStatus,
  MaintenanceBlockDto,
  MaintenanceBlockResponseDto,
  MaintenanceBlockStatus,
  MaintenanceBlockType,
  PmsEventType,
  QueryMaintenanceBlocksDto,
  RoomOccupancyStatus,
  RoomServiceStatus,
  RoomStatusLogSource,
} from '@hms/api-contracts';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';

function toUtcMidnight(dateInput: string | Date): Date {
  const str =
    typeof dateInput === 'string' ? dateInput.slice(0, 10) : dateInput.toISOString().slice(0, 10);
  return new Date(`${str}T00:00:00.000Z`);
}

function formatDateString(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function isExclusionConflict(error: any): boolean {
  if (!error) return false;
  const msg = error.message || '';
  return (
    error.code === '23P01' ||
    error.code === 'P2002' ||
    msg.includes('ex_room_maintenance_no_overlap') ||
    msg.includes('exclusion constraint') ||
    msg.includes('conflicting key value violates exclusion constraint')
  );
}

@Injectable()
export class RoomMaintenanceService {
  private readonly logger = new Logger(RoomMaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly businessDateService: PropertyBusinessDateService,
  ) {}

  public async create(
    propertyId: string,
    dto: CreateMaintenanceBlockDto,
    userId: string,
  ): Promise<MaintenanceBlockResponseDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

    const currentBusinessDate = this.businessDateService.getCurrentBusinessDate(property.timeZone);
    const startD = toUtcMidnight(dto.startDate);
    const endD = toUtcMidnight(dto.endDate);

    if (endD <= startD) {
      throw new BadRequestException('endDate must be strictly after startDate');
    }

    if (startD < currentBusinessDate) {
      throw new BadRequestException('startDate cannot be in the past');
    }

    const room = await this.prisma.room.findFirst({
      where: { id: dto.roomId, propertyId, deletedAt: null },
    });
    if (!room) {
      throw new NotFoundException(`Room '${dto.roomId}' not found on property '${propertyId}'`);
    }

    const isTodayCovered = startD <= currentBusinessDate && endD > currentBusinessDate;
    if (isTodayCovered && room.occupancyStatus === RoomOccupancyStatus.OCCUPIED) {
      throw new ConflictException('Cannot place an occupied room into immediate maintenance');
    }

    // Pre-flight application overlap check
    const existingOverlap = await this.prisma.roomMaintenanceBlock.findFirst({
      where: {
        propertyId,
        roomId: room.id,
        status: 'ACTIVE',
        deletedAt: null,
        startDate: { lt: endD },
        endDate: { gt: startD },
      },
    });
    if (existingOverlap) {
      throw new ConflictException(
        'Room already has an active maintenance block overlapping the requested dates',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        // 1. Adjust DailyInventory capacity atomically
        await this.inventoryService.adjustMaintenanceCapacity(
          propertyId,
          room.roomTypeId,
          startD,
          endD,
          dto.type,
          'INCREMENT',
          tx,
        );

        // 2. Create maintenance block with exclusion constraint protection
        let block;
        try {
          block = await tx.roomMaintenanceBlock.create({
            data: {
              id: generateUuidV7(),
              propertyId,
              roomId: room.id,
              type: dto.type,
              reason: dto.reason,
              notes: dto.notes || null,
              startDate: startD,
              endDate: endD,
              status: 'ACTIVE',
              createdBy: userId,
            },
            include: { room: true },
          });
        } catch (error: any) {
          if (isExclusionConflict(error)) {
            throw new ConflictException(
              'Room already has an active maintenance block overlapping the requested dates',
            );
          }
          throw error;
        }

        // 3. Materialize room status if today covered
        if (isTodayCovered) {
          const updateRes = await tx.room.updateMany({
            where: {
              id: room.id,
              propertyId,
              version: room.version,
            },
            data: {
              serviceStatus: dto.type,
              version: { increment: 1 },
            },
          });

          if (updateRes.count === 0) {
            throw new ConflictException(
              `Optimistic concurrency conflict while updating room '${room.roomNumber}' service status`,
            );
          }

          await tx.roomStatusLog.create({
            data: {
              id: generateUuidV7(),
              propertyId,
              roomId: room.id,
              previousHousekeepingStatus: room.housekeepingStatus,
              newHousekeepingStatus: room.housekeepingStatus,
              previousServiceStatus: room.serviceStatus,
              newServiceStatus: dto.type,
              reason: dto.reason,
              source: RoomStatusLogSource.MAINTENANCE_START,
              changedBy: userId,
            },
          });

          const statusEvent = createCloudEvent({
            type: PmsEventType.ROOM_STATUS_CHANGED,
            source: `https://pms.enterprise-hms.com/properties/${propertyId}/rooms/${room.id}`,
            subject: room.id,
            propertyId,
            data: {
              propertyId,
              roomId: room.id,
              roomNumber: room.roomNumber,
              previousHousekeepingStatus: room.housekeepingStatus,
              newHousekeepingStatus: room.housekeepingStatus,
              previousServiceStatus: room.serviceStatus,
              newServiceStatus: dto.type,
              reason: dto.reason,
              source: RoomStatusLogSource.MAINTENANCE_START,
              updatedBy: userId,
            },
          });

          await tx.outboxEvent.create({
            data: {
              id: statusEvent.id,
              specversion: statusEvent.specversion,
              type: statusEvent.type,
              source: statusEvent.source,
              subject: statusEvent.subject,
              propertyId,
              datacontenttype: statusEvent.datacontenttype,
              time: new Date(statusEvent.time),
              data: statusEvent.data as any,
              correlationId: statusEvent.correlationid,
              causationId: statusEvent.causationid,
            },
          });
        }

        // 4. Emit ROOM_MAINTENANCE_CREATED event
        const maintEvent = createCloudEvent({
          type: PmsEventType.ROOM_MAINTENANCE_CREATED,
          source: `https://pms.enterprise-hms.com/properties/${propertyId}/rooms/${room.id}`,
          subject: block.id,
          propertyId,
          data: {
            propertyId,
            maintenanceBlockId: block.id,
            roomId: room.id,
            roomNumber: room.roomNumber,
            type: block.type,
            startDate: dto.startDate,
            endDate: dto.endDate,
            reason: block.reason,
            createdBy: userId,
          },
        });

        await tx.outboxEvent.create({
          data: {
            id: maintEvent.id,
            specversion: maintEvent.specversion,
            type: maintEvent.type,
            source: maintEvent.source,
            subject: maintEvent.subject,
            propertyId,
            datacontenttype: maintEvent.datacontenttype,
            time: new Date(maintEvent.time),
            data: maintEvent.data as any,
            correlationId: maintEvent.correlationid,
            causationId: maintEvent.causationid,
          },
        });

        // 5. Evaluate overbooking advisory
        const affectedInventories = await tx.dailyInventory.findMany({
          where: {
            propertyId,
            roomTypeId: room.roomTypeId,
            businessDate: { gte: startD, lt: endD },
          },
        });

        const affectedDates: string[] = [];
        for (const inv of affectedInventories) {
          const maxUsableRooms = inv.totalRooms - inv.outOfOrderCount;
          if (inv.bookedCount > maxUsableRooms) {
            affectedDates.push(formatDateString(inv.businessDate));
          }
        }

        const response: MaintenanceBlockResponseDto = {
          maintenanceBlock: this.mapToDto(block, room.roomNumber),
        };

        if (affectedDates.length > 0) {
          response.advisory = {
            hasOverbookingRisk: true,
            affectedDates,
            message: `Creation of maintenance block causes booked reservations to exceed available rooms on ${affectedDates.length} date(s): ${affectedDates.join(', ')}`,
          };
        }

        return response;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );
  }

  public async cancel(
    propertyId: string,
    id: string,
    dto: CancelMaintenanceBlockDto,
    userId: string,
  ): Promise<MaintenanceBlockDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

    const currentBusinessDate = this.businessDateService.getCurrentBusinessDate(property.timeZone);

    return this.prisma.$transaction(
      async (tx) => {
        const block = await tx.roomMaintenanceBlock.findFirst({
          where: { id, propertyId, deletedAt: null },
          include: { room: true },
        });
        if (!block) {
          throw new NotFoundException(
            `Maintenance block '${id}' not found on property '${propertyId}'`,
          );
        }

        if (block.status !== 'ACTIVE') {
          throw new ConflictException(
            `Cannot cancel maintenance block with status '${block.status}'`,
          );
        }

        const room = block.room;
        const effectiveStart =
          block.startDate < currentBusinessDate ? currentBusinessDate : block.startDate;

        // Release inventory for unelapsed dates
        if (block.endDate > effectiveStart) {
          await this.inventoryService.adjustMaintenanceCapacity(
            propertyId,
            room.roomTypeId,
            effectiveStart,
            block.endDate,
            block.type as MaintenanceBlockType,
            'DECREMENT',
            tx,
          );
        }

        // Restore room status if today is covered
        const isTodayCovered =
          block.startDate <= currentBusinessDate && block.endDate > currentBusinessDate;
        if (isTodayCovered) {
          const otherBlock = await tx.roomMaintenanceBlock.findFirst({
            where: {
              propertyId,
              roomId: room.id,
              id: { not: block.id },
              status: 'ACTIVE',
              deletedAt: null,
              startDate: { lte: currentBusinessDate },
              endDate: { gt: currentBusinessDate },
            },
          });

          let nextServiceStatus: RoomServiceStatus;
          let nextHousekeepingStatus: HousekeepingStatus;

          if (otherBlock) {
            nextServiceStatus = otherBlock.type as RoomServiceStatus;
            nextHousekeepingStatus = room.housekeepingStatus as HousekeepingStatus;
          } else {
            nextServiceStatus = RoomServiceStatus.IN_SERVICE;
            // Post-maintenance hygiene safety invariant: room must be inspected/cleaned
            nextHousekeepingStatus = HousekeepingStatus.DIRTY;
          }

          const res = await tx.room.updateMany({
            where: {
              id: room.id,
              propertyId,
              version: room.version,
            },
            data: {
              serviceStatus: nextServiceStatus,
              housekeepingStatus: nextHousekeepingStatus,
              version: { increment: 1 },
            },
          });

          if (res.count === 0) {
            throw new ConflictException(
              `Optimistic concurrency conflict while restoring room '${room.roomNumber}' status`,
            );
          }

          await tx.roomStatusLog.create({
            data: {
              id: generateUuidV7(),
              propertyId,
              roomId: room.id,
              previousHousekeepingStatus: room.housekeepingStatus,
              newHousekeepingStatus: nextHousekeepingStatus,
              previousServiceStatus: room.serviceStatus,
              newServiceStatus: nextServiceStatus,
              reason: dto.reason,
              source: RoomStatusLogSource.MAINTENANCE_END,
              changedBy: userId,
            },
          });

          const statusEvent = createCloudEvent({
            type: PmsEventType.ROOM_STATUS_CHANGED,
            source: `https://pms.enterprise-hms.com/properties/${propertyId}/rooms/${room.id}`,
            subject: room.id,
            propertyId,
            data: {
              propertyId,
              roomId: room.id,
              roomNumber: room.roomNumber,
              previousHousekeepingStatus: room.housekeepingStatus,
              newHousekeepingStatus: nextHousekeepingStatus,
              previousServiceStatus: room.serviceStatus,
              newServiceStatus: nextServiceStatus,
              reason: dto.reason,
              source: RoomStatusLogSource.MAINTENANCE_END,
              updatedBy: userId,
            },
          });

          await tx.outboxEvent.create({
            data: {
              id: statusEvent.id,
              specversion: statusEvent.specversion,
              type: statusEvent.type,
              source: statusEvent.source,
              subject: statusEvent.subject,
              propertyId,
              datacontenttype: statusEvent.datacontenttype,
              time: new Date(statusEvent.time),
              data: statusEvent.data as any,
              correlationId: statusEvent.correlationid,
              causationId: statusEvent.causationid,
            },
          });
        }

        const updatedBlock = await tx.roomMaintenanceBlock.update({
          where: { id: block.id },
          data: {
            status: 'CANCELLED',
            cancellationReason: dto.reason,
            cancelledBy: userId,
            cancelledAt: new Date(),
            version: { increment: 1 },
          },
          include: { room: true },
        });

        const endedEvent = createCloudEvent({
          type: PmsEventType.ROOM_MAINTENANCE_ENDED,
          source: `https://pms.enterprise-hms.com/properties/${propertyId}/rooms/${room.id}`,
          subject: updatedBlock.id,
          propertyId,
          data: {
            propertyId,
            maintenanceBlockId: updatedBlock.id,
            roomId: room.id,
            roomNumber: room.roomNumber,
            type: updatedBlock.type,
            reason: dto.reason,
            cancelledBy: userId,
            cancelledAt: updatedBlock.cancelledAt?.toISOString(),
          },
        });

        await tx.outboxEvent.create({
          data: {
            id: endedEvent.id,
            specversion: endedEvent.specversion,
            type: endedEvent.type,
            source: endedEvent.source,
            subject: endedEvent.subject,
            propertyId,
            datacontenttype: endedEvent.datacontenttype,
            time: new Date(endedEvent.time),
            data: endedEvent.data as any,
            correlationId: endedEvent.correlationid,
            causationId: endedEvent.causationid,
          },
        });

        return this.mapToDto(updatedBlock, room.roomNumber);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );
  }

  public async replace(
    propertyId: string,
    id: string,
    dto: ReplaceMaintenanceBlockDto,
    userId: string,
  ): Promise<MaintenanceBlockResponseDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

    const currentBusinessDate = this.businessDateService.getCurrentBusinessDate(property.timeZone);

    return this.prisma.$transaction(
      async (tx) => {
        const oldBlock = await tx.roomMaintenanceBlock.findFirst({
          where: { id, propertyId, deletedAt: null },
          include: { room: true },
        });
        if (!oldBlock) {
          throw new NotFoundException(
            `Maintenance block '${id}' not found on property '${propertyId}'`,
          );
        }

        if (oldBlock.status !== 'ACTIVE') {
          throw new ConflictException(
            `Cannot replace maintenance block with status '${oldBlock.status}'`,
          );
        }

        if (oldBlock.type === dto.newType) {
          throw new BadRequestException(
            `Replacement type must be different from current type '${oldBlock.type}'`,
          );
        }

        const room = oldBlock.room;
        const effectiveStart =
          oldBlock.startDate < currentBusinessDate ? currentBusinessDate : oldBlock.startDate;

        if (oldBlock.endDate <= effectiveStart) {
          throw new ConflictException('Cannot replace an already elapsed maintenance block');
        }

        // 1. Cancel old block so GiST partial index condition (WHERE status = 'ACTIVE') is released
        await tx.roomMaintenanceBlock.update({
          where: { id: oldBlock.id },
          data: {
            status: 'CANCELLED',
            cancellationReason: `Replaced with ${dto.newType}: ${dto.reason}`,
            cancelledBy: userId,
            cancelledAt: new Date(),
            version: { increment: 1 },
          },
        });

        // 2. Adjust DailyInventory: decrement old type, increment new type
        await this.inventoryService.adjustMaintenanceCapacity(
          propertyId,
          room.roomTypeId,
          effectiveStart,
          oldBlock.endDate,
          oldBlock.type as MaintenanceBlockType,
          'DECREMENT',
          tx,
        );

        await this.inventoryService.adjustMaintenanceCapacity(
          propertyId,
          room.roomTypeId,
          effectiveStart,
          oldBlock.endDate,
          dto.newType,
          'INCREMENT',
          tx,
        );

        // 3. Create replacement block
        let newBlock;
        try {
          newBlock = await tx.roomMaintenanceBlock.create({
            data: {
              id: generateUuidV7(),
              propertyId,
              roomId: room.id,
              type: dto.newType,
              reason: dto.reason,
              notes: dto.notes ?? oldBlock.notes,
              startDate: effectiveStart,
              endDate: oldBlock.endDate,
              status: 'ACTIVE',
              createdBy: userId,
            },
            include: { room: true },
          });
        } catch (error: any) {
          if (isExclusionConflict(error)) {
            throw new ConflictException(
              'Replacement block conflicts with another active maintenance block',
            );
          }
          throw error;
        }

        // 4. Update room service status if today is covered
        const isTodayCovered =
          effectiveStart <= currentBusinessDate && oldBlock.endDate > currentBusinessDate;
        if (isTodayCovered) {
          const res = await tx.room.updateMany({
            where: {
              id: room.id,
              propertyId,
              version: room.version,
            },
            data: {
              serviceStatus: dto.newType,
              version: { increment: 1 },
            },
          });

          if (res.count === 0) {
            throw new ConflictException(
              `Optimistic concurrency conflict while updating room '${room.roomNumber}' service status`,
            );
          }

          await tx.roomStatusLog.create({
            data: {
              id: generateUuidV7(),
              propertyId,
              roomId: room.id,
              previousHousekeepingStatus: room.housekeepingStatus,
              newHousekeepingStatus: room.housekeepingStatus,
              previousServiceStatus: room.serviceStatus,
              newServiceStatus: dto.newType,
              reason: `Replaced block: ${dto.reason}`,
              source: RoomStatusLogSource.MANUAL,
              changedBy: userId,
            },
          });

          const statusEvent = createCloudEvent({
            type: PmsEventType.ROOM_STATUS_CHANGED,
            source: `https://pms.enterprise-hms.com/properties/${propertyId}/rooms/${room.id}`,
            subject: room.id,
            propertyId,
            data: {
              propertyId,
              roomId: room.id,
              roomNumber: room.roomNumber,
              previousHousekeepingStatus: room.housekeepingStatus,
              newHousekeepingStatus: room.housekeepingStatus,
              previousServiceStatus: room.serviceStatus,
              newServiceStatus: dto.newType,
              reason: `Replaced block: ${dto.reason}`,
              source: RoomStatusLogSource.MANUAL,
              updatedBy: userId,
            },
          });

          await tx.outboxEvent.create({
            data: {
              id: statusEvent.id,
              specversion: statusEvent.specversion,
              type: statusEvent.type,
              source: statusEvent.source,
              subject: statusEvent.subject,
              propertyId,
              datacontenttype: statusEvent.datacontenttype,
              time: new Date(statusEvent.time),
              data: statusEvent.data as any,
              correlationId: statusEvent.correlationid,
              causationId: statusEvent.causationid,
            },
          });
        }

        // 5. Emit outbox events
        const endedEvent = createCloudEvent({
          type: PmsEventType.ROOM_MAINTENANCE_ENDED,
          source: `https://pms.enterprise-hms.com/properties/${propertyId}/rooms/${room.id}`,
          subject: oldBlock.id,
          propertyId,
          data: {
            propertyId,
            maintenanceBlockId: oldBlock.id,
            roomId: room.id,
            roomNumber: room.roomNumber,
            type: oldBlock.type,
            reason: `Replaced with ${dto.newType}`,
            cancelledBy: userId,
            cancelledAt: new Date().toISOString(),
          },
        });

        await tx.outboxEvent.create({
          data: {
            id: endedEvent.id,
            specversion: endedEvent.specversion,
            type: endedEvent.type,
            source: endedEvent.source,
            subject: endedEvent.subject,
            propertyId,
            datacontenttype: endedEvent.datacontenttype,
            time: new Date(endedEvent.time),
            data: endedEvent.data as any,
            correlationId: endedEvent.correlationid,
            causationId: endedEvent.causationid,
          },
        });

        const createdEvent = createCloudEvent({
          type: PmsEventType.ROOM_MAINTENANCE_CREATED,
          source: `https://pms.enterprise-hms.com/properties/${propertyId}/rooms/${room.id}`,
          subject: newBlock.id,
          propertyId,
          data: {
            propertyId,
            maintenanceBlockId: newBlock.id,
            roomId: room.id,
            roomNumber: room.roomNumber,
            type: newBlock.type,
            startDate: formatDateString(newBlock.startDate),
            endDate: formatDateString(newBlock.endDate),
            reason: newBlock.reason,
            createdBy: userId,
          },
        });

        await tx.outboxEvent.create({
          data: {
            id: createdEvent.id,
            specversion: createdEvent.specversion,
            type: createdEvent.type,
            source: createdEvent.source,
            subject: createdEvent.subject,
            propertyId,
            datacontenttype: createdEvent.datacontenttype,
            time: new Date(createdEvent.time),
            data: createdEvent.data as any,
            correlationId: createdEvent.correlationid,
            causationId: createdEvent.causationid,
          },
        });

        // 6. Overbooking advisory evaluation
        const affectedInventories = await tx.dailyInventory.findMany({
          where: {
            propertyId,
            roomTypeId: room.roomTypeId,
            businessDate: { gte: effectiveStart, lt: oldBlock.endDate },
          },
        });

        const affectedDates: string[] = [];
        for (const inv of affectedInventories) {
          const maxUsableRooms = inv.totalRooms - inv.outOfOrderCount;
          if (inv.bookedCount > maxUsableRooms) {
            affectedDates.push(formatDateString(inv.businessDate));
          }
        }

        const response: MaintenanceBlockResponseDto = {
          maintenanceBlock: this.mapToDto(newBlock, room.roomNumber),
        };

        if (affectedDates.length > 0) {
          response.advisory = {
            hasOverbookingRisk: true,
            affectedDates,
            message: `Replacement maintenance block causes booked reservations to exceed available rooms on ${affectedDates.length} date(s): ${affectedDates.join(', ')}`,
          };
        }

        return response;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );
  }

  public async findAll(
    propertyId: string,
    query?: QueryMaintenanceBlocksDto,
  ): Promise<{ items: MaintenanceBlockDto[]; total: number; page: number; limit: number }> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

    const page = Math.max(1, query?.page ?? 1);
    const limit = Math.min(100, Math.max(1, query?.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.RoomMaintenanceBlockWhereInput = {
      propertyId,
      deletedAt: null,
      ...(query?.roomId ? { roomId: query.roomId } : {}),
      ...(query?.type ? { type: query.type } : {}),
      ...(query?.status ? { status: query.status } : {}),
      ...(query?.startDate ? { startDate: { gte: toUtcMidnight(query.startDate) } } : {}),
      ...(query?.endDate ? { endDate: { lte: toUtcMidnight(query.endDate) } } : {}),
    };

    const [blocks, total] = await Promise.all([
      this.prisma.roomMaintenanceBlock.findMany({
        where,
        include: { room: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.roomMaintenanceBlock.count({ where }),
    ]);

    const items = blocks.map((b) => this.mapToDto(b, b.room.roomNumber));
    return { items, total, page, limit };
  }

  public async findById(propertyId: string, id: string): Promise<MaintenanceBlockDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property '${propertyId}' not found`);
    }

    const block = await this.prisma.roomMaintenanceBlock.findFirst({
      where: { id, propertyId, deletedAt: null },
      include: { room: true },
    });
    if (!block) {
      throw new NotFoundException(
        `Maintenance block '${id}' not found on property '${propertyId}'`,
      );
    }

    return this.mapToDto(block, block.room.roomNumber);
  }

  private mapToDto(block: RoomMaintenanceBlock, roomNumber?: string): MaintenanceBlockDto {
    return {
      id: block.id,
      propertyId: block.propertyId,
      roomId: block.roomId,
      roomNumber,
      type: block.type as MaintenanceBlockType,
      reason: block.reason,
      notes: block.notes,
      startDate: formatDateString(block.startDate),
      endDate: formatDateString(block.endDate),
      status: block.status as MaintenanceBlockStatus,
      createdBy: block.createdBy,
      cancelledBy: block.cancelledBy,
      cancellationReason: block.cancellationReason,
      cancelledAt: block.cancelledAt ? block.cancelledAt.toISOString() : null,
      version: block.version,
      createdAt: block.createdAt.toISOString(),
      updatedAt: block.updatedAt.toISOString(),
    };
  }
}
