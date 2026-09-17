import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateFloorDto } from '../../presentation/dto/create-floor.dto';
import { UpdateFloorDto } from '../../presentation/dto/update-floor.dto';
import { FloorDto, OrganizationEventType, FloorCreatedData } from '@hms/api-contracts';
import { generateUuidV7, createCloudEvent } from '@hms/shared';

@Injectable()
export class FloorService {
  private readonly logger = new Logger(FloorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(buildingId?: string, includeDeleted = false): Promise<FloorDto[]> {
    const floors = await this.prisma.floor.findMany({
      where: {
        ...(buildingId ? { buildingId } : {}),
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: { floorNumber: 'asc' },
    });
    return floors.map(this.mapToDto);
  }

  async findById(id: string): Promise<FloorDto> {
    const floor = await this.prisma.floor.findUnique({
      where: { id },
    });
    if (!floor || floor.deletedAt) {
      throw new NotFoundException(`Floor with ID '${id}' was not found.`);
    }
    return this.mapToDto(floor);
  }

  async create(
    dto: CreateFloorDto,
    context?: { correlationId?: string; causationId?: string },
  ): Promise<FloorDto> {
    const parentBuilding = await this.prisma.building.findUnique({
      where: { id: dto.buildingId },
      include: { property: true },
    });
    if (!parentBuilding || parentBuilding.deletedAt) {
      throw new NotFoundException(`Parent Building with ID '${dto.buildingId}' was not found.`);
    }

    const existing = await this.prisma.floor.findFirst({
      where: {
        buildingId: dto.buildingId,
        code: dto.code,
      },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException(
        `Floor code '${dto.code}' already exists under Building '${parentBuilding.name}'.`,
      );
    }

    const id = generateUuidV7();
    const event = createCloudEvent<FloorCreatedData>({
      type: OrganizationEventType.FLOOR_CREATED,
      source: `https://platform.enterprise-hms.com/organizations/floors/${id}`,
      subject: id,
      propertyId: parentBuilding.propertyId,
      data: {
        floorId: id,
        buildingId: dto.buildingId,
        code: dto.code,
        name: dto.name,
        floorNumber: dto.floorNumber,
        status: 'ACTIVE',
      },
      correlationId: context?.correlationId,
      causationId: context?.causationId,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.floor.create({
        data: {
          id,
          buildingId: dto.buildingId,
          code: dto.code,
          name: dto.name,
          floorNumber: dto.floorNumber,
          status: 'ACTIVE',
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: event.id,
          specversion: event.specversion,
          type: event.type,
          source: event.source,
          subject: event.subject,
          propertyId: parentBuilding.propertyId,
          datacontenttype: event.datacontenttype,
          time: new Date(event.time),
          data: event.data as any,
          correlationId: event.correlationid,
          causationId: event.causationid,
        },
      });

      return created;
    });

    this.logger.log(`Floor created: ${result.code} (${result.name})`);
    return this.mapToDto(result);
  }

  async update(id: string, dto: UpdateFloorDto): Promise<FloorDto> {
    const existing = await this.prisma.floor.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Floor with ID '${id}' was not found.`);
    }

    const updated = await this.prisma.floor.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        floorNumber: dto.floorNumber !== undefined ? dto.floorNumber : existing.floorNumber,
        status: dto.status ?? existing.status,
      },
    });

    return this.mapToDto(updated);
  }

  async delete(id: string): Promise<FloorDto> {
    const existing = await this.prisma.floor.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Floor with ID '${id}' was not found.`);
    }

    const deleted = await this.prisma.floor.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
      },
    });

    return this.mapToDto(deleted);
  }

  private mapToDto(floor: any): FloorDto {
    return {
      id: floor.id,
      buildingId: floor.buildingId,
      code: floor.code,
      name: floor.name,
      floorNumber: floor.floorNumber,
      status: floor.status,
      createdAt: floor.createdAt.toISOString(),
      updatedAt: floor.updatedAt.toISOString(),
      deletedAt: floor.deletedAt ? floor.deletedAt.toISOString() : null,
    };
  }
}
