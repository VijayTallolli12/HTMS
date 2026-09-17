import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateHotelGroupDto } from '../../presentation/dto/create-hotel-group.dto';
import { UpdateHotelGroupDto } from '../../presentation/dto/update-hotel-group.dto';
import { HotelGroupDto, OrganizationEventType, GroupCreatedData } from '@hms/api-contracts';
import { generateUuidV7, createCloudEvent } from '@hms/shared';

@Injectable()
export class HotelGroupService {
  private readonly logger = new Logger(HotelGroupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeDeleted = false): Promise<HotelGroupDto[]> {
    const groups = await this.prisma.hotelGroup.findMany({
      where: includeDeleted ? undefined : { deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return groups.map(this.mapToDto);
  }

  async findById(id: string): Promise<HotelGroupDto> {
    const group = await this.prisma.hotelGroup.findUnique({
      where: { id },
    });
    if (!group || group.deletedAt) {
      throw new NotFoundException(`Hotel Group with ID '${id}' was not found.`);
    }
    return this.mapToDto(group);
  }

  async create(
    dto: CreateHotelGroupDto,
    context?: { correlationId?: string; causationId?: string },
  ): Promise<HotelGroupDto> {
    const existing = await this.prisma.hotelGroup.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Hotel Group with code '${dto.code}' already exists.`);
    }

    const id = generateUuidV7();
    const event = createCloudEvent<GroupCreatedData>({
      type: OrganizationEventType.GROUP_CREATED,
      source: `https://platform.enterprise-hms.com/organizations/groups/${id}`,
      subject: id,
      data: {
        groupId: id,
        code: dto.code,
        name: dto.name,
        status: 'ACTIVE',
      },
      correlationId: context?.correlationId,
      causationId: context?.causationId,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.hotelGroup.create({
        data: {
          id,
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

    this.logger.log(`Hotel Group created: ${result.code} (${result.id})`);
    return this.mapToDto(result);
  }

  async update(id: string, dto: UpdateHotelGroupDto): Promise<HotelGroupDto> {
    const existing = await this.prisma.hotelGroup.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Hotel Group with ID '${id}' was not found.`);
    }

    const updated = await this.prisma.hotelGroup.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        description: dto.description !== undefined ? dto.description : existing.description,
        status: dto.status ?? existing.status,
      },
    });

    return this.mapToDto(updated);
  }

  async delete(id: string): Promise<HotelGroupDto> {
    const existing = await this.prisma.hotelGroup.findUnique({
      where: { id },
      include: {
        regions: { where: { deletedAt: null } },
      },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Hotel Group with ID '${id}' was not found.`);
    }

    if (existing.regions.length > 0) {
      throw new ConflictException(
        `Cannot delete Hotel Group '${existing.name}': ${existing.regions.length} active Region(s) exist under it.`,
      );
    }

    const deleted = await this.prisma.hotelGroup.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
      },
    });

    return this.mapToDto(deleted);
  }

  private mapToDto(group: any): HotelGroupDto {
    return {
      id: group.id,
      code: group.code,
      name: group.name,
      description: group.description,
      status: group.status,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      deletedAt: group.deletedAt ? group.deletedAt.toISOString() : null,
    };
  }
}
