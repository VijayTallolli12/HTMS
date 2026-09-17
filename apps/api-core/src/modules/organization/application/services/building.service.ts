import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateBuildingDto } from '../../presentation/dto/create-building.dto';
import { UpdateBuildingDto } from '../../presentation/dto/update-building.dto';
import { BuildingDto, OrganizationEventType, BuildingCreatedData } from '@hms/api-contracts';
import { generateUuidV7, createCloudEvent } from '@hms/shared';

@Injectable()
export class BuildingService {
  private readonly logger = new Logger(BuildingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(propertyId?: string, includeDeleted = false): Promise<BuildingDto[]> {
    const buildings = await this.prisma.building.findMany({
      where: {
        ...(propertyId ? { propertyId } : {}),
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: { name: 'asc' },
    });
    return buildings.map(this.mapToDto);
  }

  async findById(id: string): Promise<BuildingDto> {
    const building = await this.prisma.building.findUnique({
      where: { id },
    });
    if (!building || building.deletedAt) {
      throw new NotFoundException(`Building with ID '${id}' was not found.`);
    }
    return this.mapToDto(building);
  }

  async create(
    dto: CreateBuildingDto,
    context?: { correlationId?: string; causationId?: string },
  ): Promise<BuildingDto> {
    const parentProperty = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
    });
    if (!parentProperty || parentProperty.deletedAt) {
      throw new NotFoundException(`Parent Property with ID '${dto.propertyId}' was not found.`);
    }

    const existing = await this.prisma.building.findFirst({
      where: {
        propertyId: dto.propertyId,
        code: dto.code,
      },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException(
        `Building code '${dto.code}' already exists under Property '${parentProperty.name}'.`,
      );
    }

    const id = generateUuidV7();
    const event = createCloudEvent<BuildingCreatedData>({
      type: OrganizationEventType.BUILDING_CREATED,
      source: `https://platform.enterprise-hms.com/organizations/buildings/${id}`,
      subject: id,
      propertyId: dto.propertyId,
      data: {
        buildingId: id,
        propertyId: dto.propertyId,
        code: dto.code,
        name: dto.name,
        status: 'ACTIVE',
      },
      correlationId: context?.correlationId,
      causationId: context?.causationId,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.building.create({
        data: {
          id,
          propertyId: dto.propertyId,
          code: dto.code,
          name: dto.name,
          description: dto.description || null,
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
          propertyId: dto.propertyId,
          datacontenttype: event.datacontenttype,
          time: new Date(event.time),
          data: event.data as any,
          correlationId: event.correlationid,
          causationId: event.causationid,
        },
      });

      return created;
    });

    this.logger.log(
      `Building created: ${result.code} (${result.name}) under property ${result.propertyId}`,
    );
    return this.mapToDto(result);
  }

  async update(id: string, dto: UpdateBuildingDto): Promise<BuildingDto> {
    const existing = await this.prisma.building.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Building with ID '${id}' was not found.`);
    }

    const updated = await this.prisma.building.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        description: dto.description !== undefined ? dto.description : existing.description,
        status: dto.status ?? existing.status,
      },
    });

    return this.mapToDto(updated);
  }

  async delete(id: string): Promise<BuildingDto> {
    const existing = await this.prisma.building.findUnique({
      where: { id },
      include: {
        floors: { where: { deletedAt: null } },
      },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Building with ID '${id}' was not found.`);
    }

    if (existing.floors.length > 0) {
      throw new ConflictException(
        `Cannot delete Building '${existing.name}': ${existing.floors.length} active Floor(s) exist under it.`,
      );
    }

    const deleted = await this.prisma.building.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
      },
    });

    return this.mapToDto(deleted);
  }

  private mapToDto(building: any): BuildingDto {
    return {
      id: building.id,
      propertyId: building.propertyId,
      code: building.code,
      name: building.name,
      description: building.description,
      status: building.status,
      createdAt: building.createdAt.toISOString(),
      updatedAt: building.updatedAt.toISOString(),
      deletedAt: building.deletedAt ? building.deletedAt.toISOString() : null,
    };
  }
}
