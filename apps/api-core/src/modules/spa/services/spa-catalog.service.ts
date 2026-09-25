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
  SpaTherapistDto,
  SpaRoomDto,
  SpaRoomStatus,
} from '@hms/api-contracts';
import {
  CreateSpaServiceDto,
  UpdateSpaServiceDto,
  CreateSpaTherapistDto,
  UpdateSpaTherapistDto,
  CreateSpaRoomDto,
  UpdateSpaRoomDto,
} from '../dto/spa.dto';

@Injectable()
export class SpaCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // SERVICES
  // ==========================================
  async getServices(
    propertyId: string,
    includeInactive = false,
  ): Promise<SpaServiceDto[]> {
    const services = await this.prisma.spaService.findMany({
      where: {
        propertyId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });

    return services.map(this.mapServiceToDto);
  }

  async getService(propertyId: string, id: string): Promise<SpaServiceDto> {
    const service = await this.prisma.spaService.findFirst({
      where: { id, propertyId },
    });
    if (!service) {
      throw new NotFoundException(`Spa Service '${id}' not found`);
    }
    return this.mapServiceToDto(service);
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

    const price = new Prisma.Decimal(dto.price);

    const created = await this.prisma.spaService.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
        durationMinutes: dto.durationMinutes || 60,
        price,
        currency: dto.currency || 'JPY',
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    return this.mapServiceToDto(created);
  }

  async updateService(
    propertyId: string,
    id: string,
    dto: UpdateSpaServiceDto,
  ): Promise<SpaServiceDto> {
    await this.getService(propertyId, id);

    const data: any = {};
    if (dto.name) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim();
    if (dto.durationMinutes !== undefined) data.durationMinutes = dto.durationMinutes;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.currency) data.currency = dto.currency;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.spaService.update({
      where: { id },
      data,
    });

    return this.mapServiceToDto(updated);
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
  private mapServiceToDto(s: any): SpaServiceDto {
    return {
      id: s.id,
      propertyId: s.propertyId,
      code: s.code,
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      price: s.price ? (typeof s.price === 'string' ? s.price : s.price.toFixed(2)) : '0.00',
      currency: s.currency,
      isActive: s.isActive,
      createdAt: s.createdAt?.toISOString ? s.createdAt.toISOString() : (s.createdAt || new Date().toISOString()),
      updatedAt: s.updatedAt?.toISOString ? s.updatedAt.toISOString() : (s.updatedAt || new Date().toISOString()),
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
}
