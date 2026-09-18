import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PropertyBusinessDateService } from '../../common/services/property-business-date.service';
import {
  IRoomDeactivationValidator,
  ROOM_DEACTIVATION_VALIDATOR,
} from '../contracts/room-deactivation-validator.interface';
import { CreateRoomDto } from '../dto/create-room.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { PmsEventType, RoomDto } from '@hms/api-contracts';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly businessDateService: PropertyBusinessDateService,
    @Inject(ROOM_DEACTIVATION_VALIDATOR)
    private readonly deactivationValidator: IRoomDeactivationValidator,
  ) {}

  public async create(propertyId: string, dto: CreateRoomDto): Promise<RoomDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property '${propertyId}' not found.`);
    }

    // 1. Database-Level & Application-Level Hierarchy Validation
    const building = await this.prisma.building.findUnique({
      where: { id: dto.buildingId },
    });
    if (!building || building.deletedAt) {
      throw new BadRequestException(`Building '${dto.buildingId}' not found.`);
    }
    if (building.propertyId !== propertyId) {
      throw new BadRequestException(
        `Building '${dto.buildingId}' belongs to property '${building.propertyId}', not '${propertyId}'.`,
      );
    }

    const floor = await this.prisma.floor.findUnique({
      where: { id: dto.floorId },
    });
    if (!floor || floor.deletedAt) {
      throw new BadRequestException(`Floor '${dto.floorId}' not found.`);
    }
    if (floor.buildingId !== dto.buildingId) {
      throw new BadRequestException(
        `Floor '${dto.floorId}' belongs to building '${floor.buildingId}', not '${dto.buildingId}'.`,
      );
    }

    const roomType = await this.prisma.roomType.findFirst({
      where: { id: dto.roomTypeId, propertyId, deletedAt: null },
    });
    if (!roomType) {
      throw new BadRequestException(
        `RoomType '${dto.roomTypeId}' not found or belongs to another property.`,
      );
    }

    const existingNumber = await this.prisma.room.findFirst({
      where: { propertyId, roomNumber: dto.roomNumber },
    });
    if (existingNumber) {
      throw new ConflictException(
        `Room with number '${dto.roomNumber}' already exists in property '${propertyId}'.`,
      );
    }

    const roomId = generateUuidV7();
    const today = this.businessDateService.getCurrentBusinessDate(property.timeZone);

    const event = createCloudEvent({
      type: PmsEventType.ROOM_CREATED,
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/rooms/${roomId}`,
      subject: roomId,
      propertyId,
      data: {
        roomId,
        propertyId,
        buildingId: dto.buildingId,
        floorId: dto.floorId,
        roomTypeId: dto.roomTypeId,
        roomNumber: dto.roomNumber,
      },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const room = await tx.room.create({
        data: {
          id: roomId,
          propertyId,
          buildingId: dto.buildingId,
          floorId: dto.floorId,
          roomTypeId: dto.roomTypeId,
          roomNumber: dto.roomNumber,
          name: dto.name || null,
          features: dto.features ? (dto.features as any) : null,
          isActive: true,
        },
      });

      // Synchronize totalRooms on DailyInventory for dates >= today
      await tx.dailyInventory.updateMany({
        where: {
          propertyId,
          roomTypeId: dto.roomTypeId,
          businessDate: { gte: today },
        },
        data: {
          totalRooms: { increment: 1 },
          version: { increment: 1 },
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

      return room;
    });

    this.logger.log(`Room created: ${result.roomNumber} on property ${propertyId}`);
    return this.mapToDto(result);
  }

  public async findAll(
    propertyId: string,
    filters?: { buildingId?: string; floorId?: string; roomTypeId?: string; activeOnly?: boolean },
  ): Promise<RoomDto[]> {
    const rooms = await this.prisma.room.findMany({
      where: {
        propertyId,
        deletedAt: null,
        ...(filters?.buildingId ? { buildingId: filters.buildingId } : {}),
        ...(filters?.floorId ? { floorId: filters.floorId } : {}),
        ...(filters?.roomTypeId ? { roomTypeId: filters.roomTypeId } : {}),
        ...(filters?.activeOnly ? { isActive: true } : {}),
      },
      orderBy: { roomNumber: 'asc' },
    });
    return rooms.map((r) => this.mapToDto(r));
  }

  public async findById(propertyId: string, id: string): Promise<RoomDto> {
    const room = await this.prisma.room.findFirst({
      where: { id, propertyId, deletedAt: null },
    });
    if (!room) {
      throw new NotFoundException(`Room '${id}' not found.`);
    }
    return this.mapToDto(room);
  }

  public async update(propertyId: string, id: string, dto: UpdateRoomDto): Promise<RoomDto> {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property '${propertyId}' not found.`);
    }

    const existing = await this.prisma.room.findFirst({
      where: { id, propertyId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Room '${id}' not found.`);
    }

    // Room number unique check if updated
    if (dto.roomNumber && dto.roomNumber !== existing.roomNumber) {
      const duplicate = await this.prisma.room.findFirst({
        where: { propertyId, roomNumber: dto.roomNumber, id: { not: id } },
      });
      if (duplicate) {
        throw new ConflictException(`Room number '${dto.roomNumber}' already exists.`);
      }
    }

    const today = this.businessDateService.getCurrentBusinessDate(property.timeZone);

    // Check if RoomType is changing
    const isRoomTypeChanging = dto.roomTypeId && dto.roomTypeId !== existing.roomTypeId;
    if (isRoomTypeChanging) {
      const targetRoomType = await this.prisma.roomType.findFirst({
        where: { id: dto.roomTypeId, propertyId, deletedAt: null },
      });
      if (!targetRoomType) {
        throw new BadRequestException(
          `Target RoomType '${dto.roomTypeId}' not found or belongs to another property.`,
        );
      }

      const validation = await this.deactivationValidator.canDeactivateOrDeleteRoom(propertyId, id);
      if (!validation.allowed) {
        throw new ConflictException(`Cannot reassign Room: ${validation.reason}`);
      }
    }

    // Check if isActive is changing
    const isDeactivating = dto.isActive === false && existing.isActive === true;
    const isReactivating = dto.isActive === true && existing.isActive === false;

    if (isDeactivating) {
      const validation = await this.deactivationValidator.canDeactivateOrDeleteRoom(propertyId, id);
      if (!validation.allowed) {
        throw new ConflictException(`Cannot deactivate Room: ${validation.reason}`);
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Handle RoomType reassignment with deterministic OCC lock ordering
      if (isRoomTypeChanging) {
        const oldTypeId = existing.roomTypeId;
        const newTypeId = dto.roomTypeId!;

        // Sort room type IDs to acquire locks in consistent order across concurrent transactions
        const sortedTypeIds = [oldTypeId, newTypeId].sort();

        for (const typeId of sortedTypeIds) {
          const delta = typeId === newTypeId ? 1 : -1;
          await tx.dailyInventory.updateMany({
            where: {
              propertyId,
              roomTypeId: typeId,
              businessDate: { gte: today },
            },
            data: {
              totalRooms: { increment: delta },
              version: { increment: 1 },
            },
          });
        }
      } else if (isDeactivating) {
        await tx.dailyInventory.updateMany({
          where: {
            propertyId,
            roomTypeId: existing.roomTypeId,
            businessDate: { gte: today },
          },
          data: {
            totalRooms: { decrement: 1 },
            version: { increment: 1 },
          },
        });
      } else if (isReactivating) {
        await tx.dailyInventory.updateMany({
          where: {
            propertyId,
            roomTypeId: existing.roomTypeId,
            businessDate: { gte: today },
          },
          data: {
            totalRooms: { increment: 1 },
            version: { increment: 1 },
          },
        });
      }

      const updated = await tx.room.update({
        where: { id },
        data: {
          roomNumber: dto.roomNumber ?? existing.roomNumber,
          roomTypeId: dto.roomTypeId ?? existing.roomTypeId,
          name: dto.name !== undefined ? dto.name : existing.name,
          features: dto.features !== undefined ? (dto.features as any) : existing.features,
          isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
        },
      });

      const eventType = isDeactivating ? PmsEventType.ROOM_DEACTIVATED : PmsEventType.ROOM_UPDATED;
      const event = createCloudEvent({
        type: eventType,
        source: `https://pms.enterprise-hms.com/properties/${propertyId}/rooms/${id}`,
        subject: id,
        propertyId,
        data: {
          roomId: id,
          propertyId,
          previousRoomTypeId: isRoomTypeChanging ? existing.roomTypeId : undefined,
          newRoomTypeId: isRoomTypeChanging ? dto.roomTypeId : undefined,
          roomNumber: updated.roomNumber,
          isActive: updated.isActive,
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

      return updated;
    });

    return this.mapToDto(result);
  }

  public async delete(propertyId: string, id: string): Promise<RoomDto> {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property '${propertyId}' not found.`);
    }

    const existing = await this.prisma.room.findFirst({
      where: { id, propertyId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Room '${id}' not found.`);
    }

    const validation = await this.deactivationValidator.canDeactivateOrDeleteRoom(propertyId, id);
    if (!validation.allowed) {
      throw new ConflictException(`Cannot delete Room: ${validation.reason}`);
    }

    const today = this.businessDateService.getCurrentBusinessDate(property.timeZone);

    const result = await this.prisma.$transaction(async (tx) => {
      // If room was active, decrement future totalRooms
      if (existing.isActive) {
        await tx.dailyInventory.updateMany({
          where: {
            propertyId,
            roomTypeId: existing.roomTypeId,
            businessDate: { gte: today },
          },
          data: {
            totalRooms: { decrement: 1 },
            version: { increment: 1 },
          },
        });
      }

      const deleted = await tx.room.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });

      const event = createCloudEvent({
        type: PmsEventType.ROOM_DEACTIVATED,
        source: `https://pms.enterprise-hms.com/properties/${propertyId}/rooms/${id}`,
        subject: id,
        propertyId,
        data: {
          roomId: id,
          propertyId,
          roomNumber: existing.roomNumber,
          isActive: false,
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

      return deleted;
    });

    return this.mapToDto(result);
  }

  private mapToDto(entity: any): RoomDto {
    return {
      id: entity.id,
      propertyId: entity.propertyId,
      buildingId: entity.buildingId,
      floorId: entity.floorId,
      roomTypeId: entity.roomTypeId,
      roomNumber: entity.roomNumber,
      name: entity.name,
      features: entity.features,
      isActive: entity.isActive,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      deletedAt: entity.deletedAt ? entity.deletedAt.toISOString() : null,
    };
  }
}
