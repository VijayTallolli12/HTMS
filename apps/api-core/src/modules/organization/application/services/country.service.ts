import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateCountryDto } from '../../presentation/dto/create-country.dto';
import { UpdateCountryDto } from '../../presentation/dto/update-country.dto';
import { CountryDto, OrganizationEventType, CountryCreatedData } from '@hms/api-contracts';
import { generateUuidV7, createCloudEvent } from '@hms/shared';

@Injectable()
export class CountryService {
  private readonly logger = new Logger(CountryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(regionId?: string, includeDeleted = false): Promise<CountryDto[]> {
    const countries = await this.prisma.country.findMany({
      where: {
        ...(regionId ? { regionId } : {}),
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: { name: 'asc' },
    });
    return countries.map(this.mapToDto);
  }

  async findById(id: string): Promise<CountryDto> {
    const country = await this.prisma.country.findUnique({
      where: { id },
    });
    if (!country || country.deletedAt) {
      throw new NotFoundException(`Country with ID '${id}' was not found.`);
    }
    return this.mapToDto(country);
  }

  async create(
    dto: CreateCountryDto,
    context?: { correlationId?: string; causationId?: string },
  ): Promise<CountryDto> {
    const parentRegion = await this.prisma.region.findUnique({
      where: { id: dto.regionId },
    });
    if (!parentRegion || parentRegion.deletedAt) {
      throw new NotFoundException(`Parent Region with ID '${dto.regionId}' was not found.`);
    }

    const uppercaseCode = dto.code.toUpperCase();
    const existing = await this.prisma.country.findFirst({
      where: {
        regionId: dto.regionId,
        code: uppercaseCode,
      },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException(
        `Country code '${uppercaseCode}' already exists under Region '${parentRegion.name}'.`,
      );
    }

    const id = generateUuidV7();
    const event = createCloudEvent<CountryCreatedData>({
      type: OrganizationEventType.COUNTRY_CREATED,
      source: `https://platform.enterprise-hms.com/organizations/countries/${id}`,
      subject: id,
      data: {
        countryId: id,
        regionId: dto.regionId,
        code: uppercaseCode,
        name: dto.name,
        status: 'ACTIVE',
      },
      correlationId: context?.correlationId,
      causationId: context?.causationId,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.country.create({
        data: {
          id,
          regionId: dto.regionId,
          code: uppercaseCode,
          name: dto.name,
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

    this.logger.log(`Country created: ${result.code} (${result.name})`);
    return this.mapToDto(result);
  }

  async update(id: string, dto: UpdateCountryDto): Promise<CountryDto> {
    const existing = await this.prisma.country.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Country with ID '${id}' was not found.`);
    }

    const updated = await this.prisma.country.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        status: dto.status ?? existing.status,
      },
    });

    return this.mapToDto(updated);
  }

  async delete(id: string): Promise<CountryDto> {
    const existing = await this.prisma.country.findUnique({
      where: { id },
      include: {
        properties: { where: { deletedAt: null } },
      },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Country with ID '${id}' was not found.`);
    }

    if (existing.properties.length > 0) {
      throw new ConflictException(
        `Cannot delete Country '${existing.name}': ${existing.properties.length} active Property/Properties exist under it.`,
      );
    }

    const deleted = await this.prisma.country.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
      },
    });

    return this.mapToDto(deleted);
  }

  private mapToDto(country: any): CountryDto {
    return {
      id: country.id,
      regionId: country.regionId,
      code: country.code,
      name: country.name,
      status: country.status,
      createdAt: country.createdAt.toISOString(),
      updatedAt: country.updatedAt.toISOString(),
      deletedAt: country.deletedAt ? country.deletedAt.toISOString() : null,
    };
  }
}
