import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PropertyBusinessDateService } from '../../common/services/property-business-date.service';
import {
  IRoomTypeDeletionValidator,
  ROOM_TYPE_DELETION_VALIDATOR,
} from '../contracts/room-type-deletion-validator.interface';
import { CreateRoomTypeDto } from '../dto/create-room-type.dto';
import { UpdateRoomTypeDto } from '../dto/update-room-type.dto';
import { PmsEventType, RoomTypeDto } from '@hms/api-contracts';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';

@Injectable()
export class RoomTypeService {
  private readonly logger = new Logger(RoomTypeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly businessDateService: PropertyBusinessDateService,
    @Inject(ROOM_TYPE_DELETION_VALIDATOR)
    private readonly deletionValidator: IRoomTypeDeletionValidator,
  ) {}

  public async create(propertyId: string, dto: CreateRoomTypeDto): Promise<RoomTypeDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property '${propertyId}' not found.`);
    }

    const existingCode = await this.prisma.roomType.findFirst({
      where: { propertyId, code: dto.code },
    });
    if (existingCode) {
      throw new ConflictException(
        `RoomType with code '${dto.code}' already exists in this property.`,
      );
    }

    const roomTypeId = generateUuidV7();
    const today = this.businessDateService.getCurrentBusinessDate(property.timeZone);

    const event = createCloudEvent({
      type: PmsEventType.ROOM_TYPE_CREATED,
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/room-types/${roomTypeId}`,
      subject: roomTypeId,
      propertyId,
      data: {
        roomTypeId,
        propertyId,
        code: dto.code,
        name: dto.name,
        roomClass: dto.roomClass,
        baseOccupancy: dto.baseOccupancy,
        maxOccupancy: dto.maxOccupancy,
      },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const roomType = await tx.roomType.create({
        data: {
          id: roomTypeId,
          propertyId,
          code: dto.code,
          name: dto.name,
          description: dto.description || null,
          roomClass: dto.roomClass,
          baseOccupancy: dto.baseOccupancy,
          maxOccupancy: dto.maxOccupancy,
          maxAdults: dto.maxAdults,
          maxChildren: dto.maxChildren,
          bedConfiguration: dto.bedConfiguration as any,
          amenities: dto.amenities || [],
          isActive: true,
        },
      });

      // Generate rolling 365 days of DailyInventory
      const inventoryRecords = [];
      for (let i = 0; i < 365; i++) {
        const bDate = this.businessDateService.addDays(today, i);
        inventoryRecords.push({
          id: generateUuidV7(),
          propertyId,
          roomTypeId,
          businessDate: bDate,
          totalRooms: 0,
          outOfOrderCount: 0,
          outOfServiceCount: 0,
          blockedCount: 0,
          bookedCount: 0,
          overbookingLimit: 0,
          version: 0,
        });
      }

      await tx.dailyInventory.createMany({
        data: inventoryRecords,
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

      return roomType;
    });

    this.logger.log(`RoomType created: ${result.code} (${result.name}) on property ${propertyId}`);
    return this.mapToDto(result);
  }

  public async findAll(propertyId: string, activeOnly: boolean = false): Promise<RoomTypeDto[]> {
    const roomTypes = await this.prisma.roomType.findMany({
      where: {
        propertyId,
        deletedAt: null,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { code: 'asc' },
    });
    return roomTypes.map((rt) => this.mapToDto(rt));
  }

  public async findById(propertyId: string, id: string): Promise<RoomTypeDto> {
    const roomType = await this.prisma.roomType.findFirst({
      where: { id, propertyId, deletedAt: null },
    });
    if (!roomType) {
      throw new NotFoundException(`RoomType '${id}' not found.`);
    }
    return this.mapToDto(roomType);
  }

  public async update(
    propertyId: string,
    id: string,
    dto: UpdateRoomTypeDto,
  ): Promise<RoomTypeDto> {
    const existing = await this.prisma.roomType.findFirst({
      where: { id, propertyId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`RoomType '${id}' not found.`);
    }

    const event = createCloudEvent({
      type: PmsEventType.ROOM_TYPE_UPDATED,
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/room-types/${id}`,
      subject: id,
      propertyId,
      data: {
        roomTypeId: id,
        propertyId,
        code: existing.code,
        name: dto.name ?? existing.name,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const rt = await tx.roomType.update({
        where: { id },
        data: {
          name: dto.name ?? existing.name,
          description: dto.description !== undefined ? dto.description : existing.description,
          roomClass: dto.roomClass ?? existing.roomClass,
          baseOccupancy: dto.baseOccupancy ?? existing.baseOccupancy,
          maxOccupancy: dto.maxOccupancy ?? existing.maxOccupancy,
          maxAdults: dto.maxAdults ?? existing.maxAdults,
          maxChildren: dto.maxChildren ?? existing.maxChildren,
          bedConfiguration:
            dto.bedConfiguration !== undefined
              ? (dto.bedConfiguration as any)
              : existing.bedConfiguration,
          amenities: dto.amenities ?? existing.amenities,
          isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
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

      return rt;
    });

    return this.mapToDto(updated);
  }

  public async delete(propertyId: string, id: string): Promise<RoomTypeDto> {
    const existing = await this.prisma.roomType.findFirst({
      where: { id, propertyId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`RoomType '${id}' not found.`);
    }

    // Decoupled deletion validation
    const validation = await this.deletionValidator.canDeleteRoomType(propertyId, id);
    if (!validation.allowed) {
      throw new ConflictException(
        `Cannot delete RoomType '${existing.name}': ${validation.reason}`,
      );
    }

    const event = createCloudEvent({
      type: PmsEventType.ROOM_TYPE_DELETED,
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/room-types/${id}`,
      subject: id,
      propertyId,
      data: {
        roomTypeId: id,
        propertyId,
        code: existing.code,
      },
    });

    const deleted = await this.prisma.$transaction(async (tx) => {
      const rt = await tx.roomType.update({
        where: { id },
        data: {
          deletedAt: new Date(),
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

      return rt;
    });

    return this.mapToDto(deleted);
  }

  private mapToDto(entity: any): RoomTypeDto {
    return {
      id: entity.id,
      propertyId: entity.propertyId,
      code: entity.code,
      name: entity.name,
      description: entity.description,
      roomClass: entity.roomClass,
      baseOccupancy: entity.baseOccupancy,
      maxOccupancy: entity.maxOccupancy,
      maxAdults: entity.maxAdults,
      maxChildren: entity.maxChildren,
      bedConfiguration: entity.bedConfiguration,
      amenities: entity.amenities,
      isActive: entity.isActive,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      deletedAt: entity.deletedAt ? entity.deletedAt.toISOString() : null,
    };
  }
}
