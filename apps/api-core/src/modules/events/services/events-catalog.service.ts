import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';
import { Prisma } from '@prisma/client';
import {
  EventVenueDto,
  EventPackageDto,
  EventResourceDto,
} from '@hms/api-contracts';
import {
  CreateEventVenueDto,
  UpdateEventVenueDto,
  CreateEventPackageDto,
  UpdateEventPackageDto,
  CreateEventResourceDto,
  UpdateEventResourceDto,
} from '../dto/events.dto';

@Injectable()
export class EventsCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // VENUES
  // ==========================================
  async getVenues(
    propertyId: string,
    includeInactive = false,
  ): Promise<EventVenueDto[]> {
    const venues = await this.prisma.eventVenue.findMany({
      where: {
        propertyId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });

    return venues.map(this.mapVenueToDto);
  }

  async getVenue(propertyId: string, id: string): Promise<EventVenueDto> {
    const venue = await this.prisma.eventVenue.findFirst({
      where: { id, propertyId },
    });
    if (!venue) {
      throw new NotFoundException(`Event Venue '${id}' not found`);
    }
    return this.mapVenueToDto(venue);
  }

  async createVenue(
    propertyId: string,
    dto: CreateEventVenueDto,
  ): Promise<EventVenueDto> {
    const existing = await this.prisma.eventVenue.findFirst({
      where: { propertyId, code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(
        `Event Venue code '${dto.code}' already exists for this property`,
      );
    }

    const created = await this.prisma.eventVenue.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        venueType: dto.venueType || 'BALLROOM',
        capacity: dto.capacity,
        location: dto.location?.trim(),
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    return this.mapVenueToDto(created);
  }

  async updateVenue(
    propertyId: string,
    id: string,
    dto: UpdateEventVenueDto,
  ): Promise<EventVenueDto> {
    await this.getVenue(propertyId, id);

    const data: any = {};
    if (dto.name) data.name = dto.name.trim();
    if (dto.venueType) data.venueType = dto.venueType;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.location !== undefined) data.location = dto.location?.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.eventVenue.update({
      where: { id },
      data,
    });

    return this.mapVenueToDto(updated);
  }

  // ==========================================
  // PACKAGES
  // ==========================================
  async getPackages(
    propertyId: string,
    includeInactive = false,
  ): Promise<EventPackageDto[]> {
    const packages = await this.prisma.eventPackage.findMany({
      where: {
        propertyId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });

    return packages.map(this.mapPackageToDto);
  }

  async getPackage(propertyId: string, id: string): Promise<EventPackageDto> {
    const pkg = await this.prisma.eventPackage.findFirst({
      where: { id, propertyId },
    });
    if (!pkg) {
      throw new NotFoundException(`Event Package '${id}' not found`);
    }
    return this.mapPackageToDto(pkg);
  }

  async createPackage(
    propertyId: string,
    dto: CreateEventPackageDto,
  ): Promise<EventPackageDto> {
    const existing = await this.prisma.eventPackage.findFirst({
      where: { propertyId, code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(
        `Event Package code '${dto.code}' already exists for this property`,
      );
    }

    const pricePerGuest = new Prisma.Decimal(dto.pricePerGuest);

    const created = await this.prisma.eventPackage.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
        pricePerGuest,
        currency: dto.currency || 'JPY',
        minGuests: dto.minGuests || 1,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    return this.mapPackageToDto(created);
  }

  async updatePackage(
    propertyId: string,
    id: string,
    dto: UpdateEventPackageDto,
  ): Promise<EventPackageDto> {
    await this.getPackage(propertyId, id);

    const data: any = {};
    if (dto.name) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim();
    if (dto.pricePerGuest !== undefined) data.pricePerGuest = new Prisma.Decimal(dto.pricePerGuest);
    if (dto.currency) data.currency = dto.currency;
    if (dto.minGuests !== undefined) data.minGuests = dto.minGuests;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.eventPackage.update({
      where: { id },
      data,
    });

    return this.mapPackageToDto(updated);
  }

  // ==========================================
  // RESOURCES
  // ==========================================
  async getResources(
    propertyId: string,
    includeInactive = false,
  ): Promise<EventResourceDto[]> {
    const resources = await this.prisma.eventResource.findMany({
      where: {
        propertyId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });

    return resources.map(this.mapResourceToDto);
  }

  async getResource(propertyId: string, id: string): Promise<EventResourceDto> {
    const res = await this.prisma.eventResource.findFirst({
      where: { id, propertyId },
    });
    if (!res) {
      throw new NotFoundException(`Event Resource '${id}' not found`);
    }
    return this.mapResourceToDto(res);
  }

  async createResource(
    propertyId: string,
    dto: CreateEventResourceDto,
  ): Promise<EventResourceDto> {
    const existing = await this.prisma.eventResource.findFirst({
      where: { propertyId, name: dto.name.trim() },
    });
    if (existing) {
      throw new ConflictException(
        `Event Resource '${dto.name}' already exists for this property`,
      );
    }

    const created = await this.prisma.eventResource.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        name: dto.name.trim(),
        resourceType: dto.resourceType || 'EQUIPMENT',
        totalQuantity: dto.totalQuantity,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    return this.mapResourceToDto(created);
  }

  async updateResource(
    propertyId: string,
    id: string,
    dto: UpdateEventResourceDto,
  ): Promise<EventResourceDto> {
    await this.getResource(propertyId, id);

    const data: any = {};
    if (dto.name) data.name = dto.name.trim();
    if (dto.resourceType) data.resourceType = dto.resourceType;
    if (dto.totalQuantity !== undefined) data.totalQuantity = dto.totalQuantity;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.eventResource.update({
      where: { id },
      data,
    });

    return this.mapResourceToDto(updated);
  }

  // ==========================================
  // MAPPER HELPERS
  // ==========================================
  private mapVenueToDto(v: any): EventVenueDto {
    return {
      id: v.id,
      propertyId: v.propertyId,
      code: v.code,
      name: v.name,
      venueType: v.venueType as any,
      capacity: v.capacity,
      location: v.location,
      isActive: v.isActive,
      createdAt: v.createdAt?.toISOString ? v.createdAt.toISOString() : (v.createdAt || new Date().toISOString()),
      updatedAt: v.updatedAt?.toISOString ? v.updatedAt.toISOString() : (v.updatedAt || new Date().toISOString()),
    };
  }

  private mapPackageToDto(p: any): EventPackageDto {
    return {
      id: p.id,
      propertyId: p.propertyId,
      code: p.code,
      name: p.name,
      description: p.description,
      pricePerGuest: p.pricePerGuest ? (typeof p.pricePerGuest === 'string' ? p.pricePerGuest : p.pricePerGuest.toFixed(2)) : '0.00',
      currency: p.currency,
      minGuests: p.minGuests,
      isActive: p.isActive,
      createdAt: p.createdAt?.toISOString ? p.createdAt.toISOString() : (p.createdAt || new Date().toISOString()),
      updatedAt: p.updatedAt?.toISOString ? p.updatedAt.toISOString() : (p.updatedAt || new Date().toISOString()),
    };
  }

  private mapResourceToDto(r: any): EventResourceDto {
    return {
      id: r.id,
      propertyId: r.propertyId,
      name: r.name,
      resourceType: r.resourceType as any,
      totalQuantity: r.totalQuantity,
      isActive: r.isActive,
      createdAt: r.createdAt?.toISOString ? r.createdAt.toISOString() : (r.createdAt || new Date().toISOString()),
      updatedAt: r.updatedAt?.toISOString ? r.updatedAt.toISOString() : (r.updatedAt || new Date().toISOString()),
    };
  }
}

