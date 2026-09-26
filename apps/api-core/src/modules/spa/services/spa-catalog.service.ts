import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';
import { Prisma } from '@prisma/client';
import {
  SpaServiceDto,
  SpaServiceDetailDto,
  SpaServicePriceDto,
  SpaTherapistDto,
  SpaRoomDto,
  SpaRoomStatus,
  SpaServiceCategoryDto,
  SpaServiceAddonDto,
  SpaServiceAvailability,
} from '@hms/api-contracts';
import {
  CreateSpaServiceDto,
  UpdateSpaServiceDto,
  CreateSpaTherapistDto,
  UpdateSpaTherapistDto,
  CreateSpaRoomDto,
  UpdateSpaRoomDto,
  CreateSpaServiceCategoryDto,
  UpdateSpaServiceCategoryDto,
  CreateSpaServiceAddonDto,
  UpdateSpaServiceAddonDto,
  UpdateSpaServicePriceDto,
  UpdateSpaServiceAvailabilityDto,
  QuerySpaServicesDto,
} from '../dto/spa.dto';

@Injectable()
export class SpaCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // SERVICE CATEGORIES
  // ==========================================
  async getCategories(
    propertyId: string,
    includeInactive = false,
  ): Promise<SpaServiceCategoryDto[]> {
    const categories = await this.prisma.spaServiceCategory.findMany({
      where: {
        propertyId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { displayOrder: 'asc' },
    });

    return categories.map(this.mapCategoryToDto);
  }

  async getCategory(propertyId: string, id: string): Promise<SpaServiceCategoryDto> {
    const category = await this.prisma.spaServiceCategory.findFirst({
      where: { id, propertyId },
    });
    if (!category) {
      throw new NotFoundException(`Spa Service Category '${id}' not found`);
    }
    return this.mapCategoryToDto(category);
  }

  async createCategory(
    propertyId: string,
    dto: CreateSpaServiceCategoryDto,
  ): Promise<SpaServiceCategoryDto> {
    const existing = await this.prisma.spaServiceCategory.findFirst({
      where: { propertyId, code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(
        `Spa Service Category code '${dto.code}' already exists for this property`,
      );
    }

    const created = await this.prisma.spaServiceCategory.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
        displayOrder: dto.displayOrder || 0,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    return this.mapCategoryToDto(created);
  }

  async updateCategory(
    propertyId: string,
    id: string,
    dto: UpdateSpaServiceCategoryDto,
  ): Promise<SpaServiceCategoryDto> {
    await this.getCategory(propertyId, id);

    const data: any = {};
    if (dto.name) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim();
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.spaServiceCategory.update({
      where: { id },
      data,
    });

    return this.mapCategoryToDto(updated);
  }

  // ==========================================
  // SERVICES
  // ==========================================
  async getServices(
    propertyId: string,
    query: QuerySpaServicesDto = {},
  ): Promise<SpaServiceDto[]> {
    const where: any = { propertyId };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.availability) {
      where.availability = query.availability;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const services = await this.prisma.spaService.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    });

    return services.map(this.mapServiceToDto);
  }

  async getService(propertyId: string, id: string): Promise<SpaServiceDto> {
    const service = await this.prisma.spaService.findFirst({
      where: { id, propertyId },
      include: { category: true },
    });
    if (!service) {
      throw new NotFoundException(`Spa Service '${id}' not found`);
    }
    return this.mapServiceToDto(service);
  }

  async getServiceDetail(propertyId: string, id: string): Promise<SpaServiceDetailDto> {
    const service = await this.prisma.spaService.findFirst({
      where: { id, propertyId },
      include: { category: true, addons: true },
    });
    if (!service) {
      throw new NotFoundException(`Spa Service '${id}' not found`);
    }
    return this.mapServiceToDetailDto(service);
  }

  async createService(
    propertyId: string,
    dto: CreateSpaServiceDto,
  ): Promise<SpaServiceDto> {
    const existing = await this.prisma.spaService.findFirst({
      where: { propertyId, code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(
        `Spa Service code '${dto.code}' already exists for this property`,
      );
    }

    if (dto.categoryId) {
      const category = await this.prisma.spaServiceCategory.findFirst({
        where: { id: dto.categoryId, propertyId },
      });
      if (!category) {
        throw new NotFoundException(`Spa Service Category '${dto.categoryId}' not found`);
      }
    }

    const price = new Prisma.Decimal(dto.price);

    const created = await this.prisma.spaService.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        categoryId: dto.categoryId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
        durationMinutes: dto.durationMinutes || 60,
        price,
        currency: dto.currency || 'JPY',
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        availability: dto.availability || 'AVAILABLE',
        eligibleTherapistIds: dto.eligibleTherapistIds,
        eligibleRoomTypes: dto.eligibleRoomTypes,
      },
      include: { category: true },
    });

    return this.mapServiceToDto(created);
  }

  async updateService(
    propertyId: string,
    id: string,
    dto: UpdateSpaServiceDto,
  ): Promise<SpaServiceDto> {
    await this.getService(propertyId, id);

    if (dto.categoryId) {
      const category = await this.prisma.spaServiceCategory.findFirst({
        where: { id: dto.categoryId, propertyId },
      });
      if (!category) {
        throw new NotFoundException(`Spa Service Category '${dto.categoryId}' not found`);
      }
    }

    const data: any = {};
    if (dto.name) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim();
    if (dto.durationMinutes !== undefined) data.durationMinutes = dto.durationMinutes;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.currency) data.currency = dto.currency;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.availability !== undefined) data.availability = dto.availability;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.eligibleTherapistIds !== undefined) data.eligibleTherapistIds = dto.eligibleTherapistIds;
    if (dto.eligibleRoomTypes !== undefined) data.eligibleRoomTypes = dto.eligibleRoomTypes;

    const updated = await this.prisma.spaService.update({
      where: { id },
      data,
      include: { category: true },
    });

    return this.mapServiceToDto(updated);
  }

  async updateServicePrice(
    propertyId: string,
    id: string,
    dto: UpdateSpaServicePriceDto,
  ): Promise<SpaServicePriceDto> {
    await this.getService(propertyId, id);

    const price = new Prisma.Decimal(dto.price);

    const updated = await this.prisma.spaService.update({
      where: { id },
      data: { price },
      include: { category: true, addons: true },
    });

    return this.mapServiceToPriceDto(updated);
  }

  async updateServiceAvailability(
    propertyId: string,
    id: string,
    dto: UpdateSpaServiceAvailabilityDto,
  ): Promise<SpaServiceDto> {
    await this.getService(propertyId, id);

    const updated = await this.prisma.spaService.update({
      where: { id },
      data: { availability: dto.availability },
      include: { category: true },
    });

    return this.mapServiceToDto(updated);
  }

  // ==========================================
  // SERVICE ADDONS
  // ==========================================
  async getAddons(propertyId: string, serviceId: string): Promise<SpaServiceAddonDto[]> {
    const addons = await this.prisma.spaServiceAddon.findMany({
      where: { propertyId, serviceId },
      orderBy: { name: 'asc' },
    });

    return addons.map(this.mapAddonToDto);
  }

  async getAddon(propertyId: string, id: string): Promise<SpaServiceAddonDto> {
    const addon = await this.prisma.spaServiceAddon.findFirst({
      where: { id, propertyId },
    });
    if (!addon) {
      throw new NotFoundException(`Spa Service Addon '${id}' not found`);
    }
    return this.mapAddonToDto(addon);
  }

  async createAddon(
    propertyId: string,
    dto: CreateSpaServiceAddonDto,
  ): Promise<SpaServiceAddonDto> {
    const service = await this.prisma.spaService.findFirst({
      where: { id: dto.serviceId, propertyId },
    });
    if (!service) {
      throw new NotFoundException(`Spa Service '${dto.serviceId}' not found`);
    }

    const existing = await this.prisma.spaServiceAddon.findFirst({
      where: { serviceId: dto.serviceId, code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(
        `Addon code '${dto.code}' already exists for this service`,
      );
    }

    const priceAdjustment = new Prisma.Decimal(dto.priceAdjustment || 0);

    const created = await this.prisma.spaServiceAddon.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        serviceId: dto.serviceId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
        priceAdjustment,
        currency: dto.currency || 'JPY',
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    return this.mapAddonToDto(created);
  }

  async updateAddon(
    propertyId: string,
    id: string,
    dto: UpdateSpaServiceAddonDto,
  ): Promise<SpaServiceAddonDto> {
    await this.getAddon(propertyId, id);

    const data: any = {};
    if (dto.name) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim();
    if (dto.priceAdjustment !== undefined) data.priceAdjustment = new Prisma.Decimal(dto.priceAdjustment);
    if (dto.currency) data.currency = dto.currency;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.spaServiceAddon.update({
      where: { id },
      data,
    });

    return this.mapAddonToDto(updated);
  }

  async deleteAddon(propertyId: string, id: string): Promise<void> {
    await this.getAddon(propertyId, id);
    await this.prisma.spaServiceAddon.delete({ where: { id } });
  }

  // ==========================================
  // THERAPISTS
  // ==========================================
  async getTherapists(
    propertyId: string,
    includeInactive = false,
  ): Promise<SpaTherapistDto[]> {
    const therapists = await this.prisma.spaTherapist.findMany({
      where: {
        propertyId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });

    return therapists.map(this.mapTherapistToDto);
  }

  async getTherapist(propertyId: string, id: string): Promise<SpaTherapistDto> {
    const therapist = await this.prisma.spaTherapist.findFirst({
      where: { id, propertyId },
    });
    if (!therapist) {
      throw new NotFoundException(`Spa Therapist '${id}' not found`);
    }
    return this.mapTherapistToDto(therapist);
  }

  async createTherapist(
    propertyId: string,
    dto: CreateSpaTherapistDto,
  ): Promise<SpaTherapistDto> {
    const created = await this.prisma.spaTherapist.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        name: dto.name.trim(),
        specialty: dto.specialty?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.trim(),
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    return this.mapTherapistToDto(created);
  }

  async updateTherapist(
    propertyId: string,
    id: string,
    dto: UpdateSpaTherapistDto,
  ): Promise<SpaTherapistDto> {
    await this.getTherapist(propertyId, id);

    const data: any = {};
    if (dto.name) data.name = dto.name.trim();
    if (dto.specialty !== undefined) data.specialty = dto.specialty?.trim();
    if (dto.phone !== undefined) data.phone = dto.phone?.trim();
    if (dto.email !== undefined) data.email = dto.email?.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.spaTherapist.update({
      where: { id },
      data,
    });

    return this.mapTherapistToDto(updated);
  }

  // ==========================================
  // ROOMS
  // ==========================================
  async getRooms(
    propertyId: string,
    status?: SpaRoomStatus,
  ): Promise<SpaRoomDto[]> {
    const rooms = await this.prisma.spaRoom.findMany({
      where: {
        propertyId,
        ...(status ? { status } : {}),
      },
      orderBy: { name: 'asc' },
    });

    return rooms.map(this.mapRoomToDto);
  }

  async getRoom(propertyId: string, id: string): Promise<SpaRoomDto> {
    const room = await this.prisma.spaRoom.findFirst({
      where: { id, propertyId },
    });
    if (!room) {
      throw new NotFoundException(`Spa Treatment Room '${id}' not found`);
    }
    return this.mapRoomToDto(room);
  }

  async createRoom(
    propertyId: string,
    dto: CreateSpaRoomDto,
  ): Promise<SpaRoomDto> {
    const existing = await this.prisma.spaRoom.findFirst({
      where: { propertyId, name: dto.name.trim() },
    });
    if (existing) {
      throw new ConflictException(
        `Spa Room '${dto.name}' already exists for this property`,
      );
    }

    const created = await this.prisma.spaRoom.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        name: dto.name.trim(),
        roomType: dto.roomType || 'SINGLE',
        status: dto.status || 'AVAILABLE',
      },
    });

    return this.mapRoomToDto(created);
  }

  async updateRoom(
    propertyId: string,
    id: string,
    dto: UpdateSpaRoomDto,
  ): Promise<SpaRoomDto> {
    await this.getRoom(propertyId, id);

    const data: any = {};
    if (dto.name) data.name = dto.name.trim();
    if (dto.roomType) data.roomType = dto.roomType;
    if (dto.status) data.status = dto.status;

    const updated = await this.prisma.spaRoom.update({
      where: { id },
      data,
    });

    return this.mapRoomToDto(updated);
  }

  // ==========================================
  // MAPPER HELPERS
  // ==========================================
  private mapCategoryToDto(c: any): SpaServiceCategoryDto {
    return {
      id: c.id,
      propertyId: c.propertyId,
      code: c.code,
      name: c.name,
      description: c.description,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
      createdAt: c.createdAt?.toISOString ? c.createdAt.toISOString() : (c.createdAt || new Date().toISOString()),
      updatedAt: c.updatedAt?.toISOString ? c.updatedAt.toISOString() : (c.updatedAt || new Date().toISOString()),
    };
  }

  private mapServiceToDto(s: any): SpaServiceDto {
    return {
      id: s.id,
      propertyId: s.propertyId,
      categoryId: s.categoryId,
      categoryName: s.category?.name || null,
      code: s.code,
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      price: s.price ? (typeof s.price === 'string' ? s.price : s.price.toFixed(2)) : '0.00',
      currency: s.currency,
      isActive: s.isActive,
      availability: s.availability as SpaServiceAvailability,
      eligibleTherapistIds: s.eligibleTherapistIds,
      eligibleRoomTypes: s.eligibleRoomTypes,
      createdAt: s.createdAt?.toISOString ? s.createdAt.toISOString() : (s.createdAt || new Date().toISOString()),
      updatedAt: s.updatedAt?.toISOString ? s.updatedAt.toISOString() : (s.updatedAt || new Date().toISOString()),
    };
  }

  private mapServiceToDetailDto(s: any): SpaServiceDetailDto {
    return {
      id: s.id,
      propertyId: s.propertyId,
      categoryId: s.categoryId,
      categoryName: s.category?.name || null,
      code: s.code,
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      price: s.price ? (typeof s.price === 'string' ? s.price : s.price.toFixed(2)) : '0.00',
      currency: s.currency,
      availability: s.availability as SpaServiceAvailability,
      isActive: s.isActive,
      eligibleTherapistIds: s.eligibleTherapistIds,
      eligibleRoomTypes: s.eligibleRoomTypes,
      createdAt: s.createdAt?.toISOString ? s.createdAt.toISOString() : (s.createdAt || new Date().toISOString()),
      updatedAt: s.updatedAt?.toISOString ? s.updatedAt.toISOString() : (s.updatedAt || new Date().toISOString()),
      addons: s.addons?.map(this.mapAddonToDto) || [],
    };
  }

  private mapServiceToPriceDto(s: any): SpaServicePriceDto {
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      basePrice: s.price ? (typeof s.price === 'string' ? s.price : s.price.toFixed(2)) : '0.00',
      currency: s.currency,
      availability: s.availability as SpaServiceAvailability,
      durationMinutes: s.durationMinutes,
      addons: s.addons?.map(this.mapAddonToDto) || [],
    };
  }

  private mapTherapistToDto(t: any): SpaTherapistDto {
    return {
      id: t.id,
      propertyId: t.propertyId,
      name: t.name,
      specialty: t.specialty,
      phone: t.phone,
      email: t.email,
      isActive: t.isActive,
      createdAt: t.createdAt?.toISOString ? t.createdAt.toISOString() : (t.createdAt || new Date().toISOString()),
      updatedAt: t.updatedAt?.toISOString ? t.updatedAt.toISOString() : (t.updatedAt || new Date().toISOString()),
    };
  }

  private mapRoomToDto(r: any): SpaRoomDto {
    return {
      id: r.id,
      propertyId: r.propertyId,
      name: r.name,
      roomType: r.roomType as any,
      status: r.status as any,
      createdAt: r.createdAt?.toISOString ? r.createdAt.toISOString() : (r.createdAt || new Date().toISOString()),
      updatedAt: r.updatedAt?.toISOString ? r.updatedAt.toISOString() : (r.updatedAt || new Date().toISOString()),
    };
  }

  private mapAddonToDto(a: any): SpaServiceAddonDto {
    return {
      id: a.id,
      propertyId: a.propertyId,
      serviceId: a.serviceId,
      code: a.code,
      name: a.name,
      description: a.description,
      priceAdjustment: a.priceAdjustment ? (typeof a.priceAdjustment === 'string' ? a.priceAdjustment : a.priceAdjustment.toFixed(2)) : '0.00',
      currency: a.currency,
      isActive: a.isActive,
      createdAt: a.createdAt?.toISOString ? a.createdAt.toISOString() : (a.createdAt || new Date().toISOString()),
      updatedAt: a.updatedAt?.toISOString ? a.updatedAt.toISOString() : (a.updatedAt || new Date().toISOString()),
    };
  }
}