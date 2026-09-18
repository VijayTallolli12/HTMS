import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreatePropertyDto } from '../../presentation/dto/create-property.dto';
import { UpdatePropertyDto } from '../../presentation/dto/update-property.dto';
import { PropertyDto, OrganizationEventType, PropertyCreatedData } from '@hms/api-contracts';
import { generateUuidV7, createCloudEvent } from '@hms/shared';

@Injectable()
export class PropertyService {
  private readonly logger = new Logger(PropertyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters?: {
    countryId?: string;
    status?: string;
    includeDeleted?: boolean;
  }): Promise<PropertyDto[]> {
    const properties = await this.prisma.property.findMany({
      where: {
        ...(filters?.countryId ? { countryId: filters.countryId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: { name: 'asc' },
    });
    return properties.map(this.mapToDto);
  }

  async findById(id: string): Promise<PropertyDto> {
    const property = await this.prisma.property.findUnique({
      where: { id },
    });
    if (!property || property.deletedAt) {
      throw new NotFoundException(`Property with ID '${id}' was not found.`);
    }
    return this.mapToDto(property);
  }

  async create(
    dto: CreatePropertyDto,
    context?: { correlationId?: string; causationId?: string },
  ): Promise<PropertyDto> {
    const parentCountry = await this.prisma.country.findUnique({
      where: { id: dto.countryId },
    });
    if (!parentCountry || parentCountry.deletedAt) {
      throw new NotFoundException(`Parent Country with ID '${dto.countryId}' was not found.`);
    }

    const existingCode = await this.prisma.property.findUnique({
      where: { code: dto.code },
    });
    if (existingCode) {
      throw new ConflictException(`Property with enterprise code '${dto.code}' already exists.`);
    }

    this.validateTimeZone(dto.timeZone);

    const id = generateUuidV7();
    const event = createCloudEvent<PropertyCreatedData>({
      type: OrganizationEventType.PROPERTY_CREATED,
      source: `https://platform.enterprise-hms.com/organizations/properties/${id}`,
      subject: id,
      propertyId: id,
      data: {
        propertyId: id,
        countryId: dto.countryId,
        code: dto.code,
        name: dto.name,
        status: 'ACTIVE',
        timeZone: dto.timeZone,
        currency: dto.currency.toUpperCase(),
      },
      correlationId: context?.correlationId,
      causationId: context?.causationId,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.property.create({
        data: {
          id,
          countryId: dto.countryId,
          code: dto.code,
          name: dto.name,
          legalName: dto.legalName || null,
          status: 'ACTIVE',
          timeZone: dto.timeZone,
          currency: dto.currency.toUpperCase(),
          addressLine1: dto.addressLine1 || null,
          addressLine2: dto.addressLine2 || null,
          city: dto.city || null,
          stateProvince: dto.stateProvince || null,
          postalCode: dto.postalCode || null,
          phone: dto.phone || null,
          email: dto.email || null,
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: event.id,
          specversion: event.specversion,
          type: event.type,
          source: event.source,
          subject: event.subject,
          propertyId: id,
          datacontenttype: event.datacontenttype,
          time: new Date(event.time),
          data: event.data as any,
          correlationId: event.correlationid,
          causationId: event.causationid,
        },
      });

      return created;
    });

    this.logger.log(`Property created: ${result.code} - ${result.name} (${result.id})`);
    return this.mapToDto(result);
  }

  async update(id: string, dto: UpdatePropertyDto): Promise<PropertyDto> {
    const existing = await this.prisma.property.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Property with ID '${id}' was not found.`);
    }

    if (dto.timeZone) {
      this.validateTimeZone(dto.timeZone);
    }

    if (dto.currency && dto.currency.toUpperCase() !== existing.currency) {
      const ratePlanCount = await this.prisma.ratePlan.count({ where: { propertyId: id } });
      if (ratePlanCount > 0) {
        throw new ConflictException(
          'Property currency cannot be changed once rate plans have been created.',
        );
      }
    }

    const updated = await this.prisma.property.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        legalName: dto.legalName !== undefined ? dto.legalName : existing.legalName,
        status: dto.status ?? existing.status,
        timeZone: dto.timeZone ?? existing.timeZone,
        currency: dto.currency ? dto.currency.toUpperCase() : existing.currency,
        addressLine1: dto.addressLine1 !== undefined ? dto.addressLine1 : existing.addressLine1,
        addressLine2: dto.addressLine2 !== undefined ? dto.addressLine2 : existing.addressLine2,
        city: dto.city !== undefined ? dto.city : existing.city,
        stateProvince: dto.stateProvince !== undefined ? dto.stateProvince : existing.stateProvince,
        postalCode: dto.postalCode !== undefined ? dto.postalCode : existing.postalCode,
        phone: dto.phone !== undefined ? dto.phone : existing.phone,
        email: dto.email !== undefined ? dto.email : existing.email,
      },
    });

    return this.mapToDto(updated);
  }

  async delete(id: string): Promise<PropertyDto> {
    const existing = await this.prisma.property.findUnique({
      where: { id },
      include: {
        buildings: { where: { deletedAt: null } },
      },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Property with ID '${id}' was not found.`);
    }

    if (existing.buildings.length > 0) {
      throw new ConflictException(
        `Cannot delete Property '${existing.name}': ${existing.buildings.length} active Building(s) exist under it.`,
      );
    }

    const deleted = await this.prisma.property.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
      },
    });

    return this.mapToDto(deleted);
  }

  private validateTimeZone(timeZone: string): void {
    try {
      Intl.DateTimeFormat(undefined, { timeZone });
    } catch {
      throw new BadRequestException(
        `Invalid IANA time zone identifier: '${timeZone}'. Valid examples include 'Asia/Tokyo', 'America/New_York', 'Europe/London'.`,
      );
    }
  }

  private mapToDto(property: any): PropertyDto {
    return {
      id: property.id,
      countryId: property.countryId,
      code: property.code,
      name: property.name,
      legalName: property.legalName,
      status: property.status,
      timeZone: property.timeZone,
      currency: property.currency,
      addressLine1: property.addressLine1,
      addressLine2: property.addressLine2,
      city: property.city,
      stateProvince: property.stateProvince,
      postalCode: property.postalCode,
      phone: property.phone,
      email: property.email,
      createdAt: property.createdAt.toISOString(),
      updatedAt: property.updatedAt.toISOString(),
      deletedAt: property.deletedAt ? property.deletedAt.toISOString() : null,
    };
  }
}
