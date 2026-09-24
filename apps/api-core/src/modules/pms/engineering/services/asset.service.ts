import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import {
  AssetDto,
  AssetListResponse,
  AssetStatus,
  CreateAssetRequest,
  PmsEventType,
  QueryAssetsDto,
  UpdateAssetRequest,
} from '@hms/api-contracts';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';

@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    propertyId: string,
    query: QueryAssetsDto,
  ): Promise<AssetListResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AssetWhereInput = {
      propertyId,
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.category && { category: query.category }),
      ...(query.roomId && { roomId: query.roomId }),
      ...(query.search && {
        OR: [
          { code: { contains: query.search, mode: 'insensitive' } },
          { name: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: { room: true },
        orderBy: [{ code: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.asset.count({ where }),
    ]);

    return {
      items: items.map((a) => this.mapToDto(a)),
      total,
      page,
      limit,
    };
  }

  async findById(propertyId: string, assetId: string): Promise<AssetDto> {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, propertyId, deletedAt: null },
      include: { room: true },
    });
    if (!asset) {
      throw new NotFoundException(`Asset '${assetId}' not found on property '${propertyId}'`);
    }
    return this.mapToDto(asset);
  }

  async create(
    propertyId: string,
    req: CreateAssetRequest,
    actorId: string,
  ): Promise<AssetDto> {
    if (!req.code?.trim()) {
      throw new BadRequestException('Asset code is required');
    }
    if (!req.name?.trim()) {
      throw new BadRequestException('Asset name is required');
    }
    if (!req.category?.trim()) {
      throw new BadRequestException('Asset category is required');
    }

    const existing = await this.prisma.asset.findFirst({
      where: { propertyId, code: req.code.trim().toUpperCase(), deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        `Asset code '${req.code.trim().toUpperCase()}' already exists on property '${propertyId}'`,
      );
    }

    if (req.roomId) {
      const room = await this.prisma.room.findFirst({
        where: { id: req.roomId, propertyId, deletedAt: null },
      });
      if (!room) {
        throw new NotFoundException(`Room '${req.roomId}' not found on property '${propertyId}'`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          code: req.code.trim().toUpperCase(),
          name: req.name.trim(),
          category: req.category.trim().toUpperCase(),
          status: req.status || AssetStatus.ACTIVE,
          description: req.description?.trim() || null,
          roomId: req.roomId || null,
        },
        include: { room: true },
      });

      const event = createCloudEvent({
        type: PmsEventType.ENGINEERING_ASSET_CREATED,
        source: `https://pms.enterprise-hms.com/properties/${propertyId}/engineering/assets/${asset.id}`,
        subject: asset.id,
        propertyId,
        data: {
          propertyId,
          assetId: asset.id,
          code: asset.code,
          name: asset.name,
          category: asset.category,
          status: asset.status,
          roomId: asset.roomId,
          createdBy: actorId,
          createdAt: asset.createdAt.toISOString(),
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

      this.logger.log(`Asset '${asset.code}' created on property '${propertyId}'`);
      return this.mapToDto(asset);
    });
  }

  async update(
    propertyId: string,
    assetId: string,
    req: UpdateAssetRequest,
    actorId: string,
  ): Promise<AssetDto> {
    if (req.roomId) {
      const room = await this.prisma.room.findFirst({
        where: { id: req.roomId, propertyId, deletedAt: null },
      });
      if (!room) {
        throw new NotFoundException(`Room '${req.roomId}' not found on property '${propertyId}'`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.asset.findFirst({
        where: { id: assetId, propertyId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Asset '${assetId}' not found on property '${propertyId}'`);
      }

      const updateData: Prisma.AssetUpdateInput = {
        version: { increment: 1 },
        ...(req.name !== undefined && { name: req.name.trim() }),
        ...(req.category !== undefined && { category: req.category.trim().toUpperCase() }),
        ...(req.status !== undefined && { status: req.status }),
        ...(req.description !== undefined && { description: req.description?.trim() || null }),
        ...(req.roomId !== undefined && { room: req.roomId ? { connect: { uq_rooms_property_id: { propertyId, id: req.roomId } } } : { disconnect: true } }),
      };

      const res = await tx.asset.updateMany({
        where: { id: assetId, propertyId, version: req.version, deletedAt: null },
        data: {
          ...(req.name !== undefined && { name: req.name.trim() }),
          ...(req.category !== undefined && { category: req.category.trim().toUpperCase() }),
          ...(req.status !== undefined && { status: req.status }),
          ...(req.description !== undefined && { description: req.description?.trim() || null }),
          ...(req.roomId !== undefined && { roomId: req.roomId }),
          version: { increment: 1 },
        },
      });

      if (res.count === 0) {
        throw new ConflictException('Optimistic concurrency conflict while updating asset');
      }

      const updated = await tx.asset.findUniqueOrThrow({
        where: { id: assetId },
        include: { room: true },
      });

      const event = createCloudEvent({
        type: PmsEventType.ENGINEERING_ASSET_UPDATED,
        source: `https://pms.enterprise-hms.com/properties/${propertyId}/engineering/assets/${updated.id}`,
        subject: updated.id,
        propertyId,
        data: {
          propertyId,
          assetId: updated.id,
          code: updated.code,
          name: updated.name,
          category: updated.category,
          status: updated.status,
          updatedBy: actorId,
          updatedAt: updated.updatedAt.toISOString(),
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

      this.logger.log(`Asset '${updated.code}' updated on property '${propertyId}'`);
      return this.mapToDto(updated);
    });
  }

  async delete(propertyId: string, assetId: string, _actorId: string): Promise<void> {
    const existing = await this.prisma.asset.findFirst({
      where: { id: assetId, propertyId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Asset '${assetId}' not found on property '${propertyId}'`);
    }

    await this.prisma.asset.update({
      where: { id: assetId },
      data: { deletedAt: new Date() },
    });
  }

  private mapToDto(asset: any): AssetDto {
    return {
      id: asset.id,
      propertyId: asset.propertyId,
      code: asset.code,
      name: asset.name,
      category: asset.category,
      status: asset.status as AssetStatus,
      description: asset.description,
      roomId: asset.roomId,
      roomNumber: asset.room?.roomNumber || null,
      version: asset.version,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    };
  }
}

