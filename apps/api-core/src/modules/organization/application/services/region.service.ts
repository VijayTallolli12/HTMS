import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateRegionDto } from '../../presentation/dto/create-region.dto';
import { UpdateRegionDto } from '../../presentation/dto/update-region.dto';
import { RegionDto, OrganizationEventType, RegionCreatedData } from '@hms/api-contracts';
import { generateUuidV7, createCloudEvent } from '@hms/shared';

@Injectable()
export class RegionService {
  private readonly logger = new Logger(RegionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(hotelGroupId?: string, includeDeleted = false): Promise<RegionDto[]> {
    const regions = await this.prisma.region.findMany({
      where: {
        ...(hotelGroupId ? { hotelGroupId } : {}),
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: { name: 'asc' },
    });
    return regions.map(this.mapToDto);
  }

  async findById(id: string): Promise<RegionDto> {
    const region = await this.prisma.region.findUnique({
      where: { id },
    });
    if (!region || region.deletedAt) {
      throw new NotFoundException(`Region with ID '${id}' was not found.`);
    }
    return this.mapToDto(region);
  }

  async create(
    dto: CreateRegionDto,
    context?: { correlationId?: string; causationId?: string },
  ): Promise<RegionDto> {
    const parentGroup = await this.prisma.hotelGroup.findUnique({
      where: { id: dto.hotelGroupId },
    });
    if (!parentGroup || parentGroup.deletedAt) {
      throw new NotFoundException(
        `Parent Hotel Group with ID '${dto.hotelGroupId}' was not found.`,
      );
    }

    const existing = await this.prisma.region.findFirst({
      where: {
        hotelGroupId: dto.hotelGroupId,
        code: dto.code,
      },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException(
        `Region with code '${dto.code}' already exists under Hotel Group '${parentGroup.name}'.`,
      );
    }

    const id = generateUuidV7();
    const event = createCloudEvent<RegionCreatedData>({
      type: OrganizationEventType.REGION_CREATED,
      source: `https://platform.enterprise-hms.com/organizations/regions/${id}`,
      subject: id,
      data: {
        regionId: id,
        hotelGroupId: dto.hotelGroupId,
        code: dto.code,
        name: dto.name,
        status: 'ACTIVE',
      },
      correlationId: context?.correlationId,
      causationId: context?.causationId,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.region.create({
        data: {
          id,
          hotelGroupId: dto.hotelGroupId,
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
          datacontenttype: event.datacontenttype,
          time: new Date(event.time),
          data: event.data as any,
          correlationId: event.correlationid,
          causationId: event.causationid,
        },
      });

      return created;
    });

    this.logger.log(`Region created: ${result.code} under group ${result.hotelGroupId}`);
    return this.mapToDto(result);
  }

  async update(id: string, dto: UpdateRegionDto): Promise<RegionDto> {
    const existing = await this.prisma.region.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Region with ID '${id}' was not found.`);
    }

    const updated = await this.prisma.region.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        description: dto.description !== undefined ? dto.description : existing.description,
        status: dto.status ?? existing.status,
      },
    });

    return this.mapToDto(updated);
  }

  async delete(id: string): Promise<RegionDto> {
    const existing = await this.prisma.region.findUnique({
      where: { id },
      include: {
        countries: { where: { deletedAt: null } },
      },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Region with ID '${id}' was not found.`);
    }

    if (existing.countries.length > 0) {
      throw new ConflictException(
        `Cannot delete Region '${existing.name}': ${existing.countries.length} active Country record(s) exist under it.`,
      );
    }

    const deleted = await this.prisma.region.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
      },
    });

    return this.mapToDto(deleted);
  }

  private mapToDto(region: any): RegionDto {
    return {
      id: region.id,
      hotelGroupId: region.hotelGroupId,
      code: region.code,
      name: region.name,
      description: region.description,
      status: region.status,
      createdAt: region.createdAt.toISOString(),
      updatedAt: region.updatedAt.toISOString(),
      deletedAt: region.deletedAt ? region.deletedAt.toISOString() : null,
    };
  }
}
