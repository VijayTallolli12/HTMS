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
  CreateMaintenanceScheduleRequest,
  MaintenanceFrequency,
  MaintenanceScheduleDto,
  MaintenanceScheduleListResponse,
  PmsEventType,
  QueryMaintenanceSchedulesDto,
  ScheduleDueStatus,
  UpdateMaintenanceScheduleRequest,
} from '@hms/api-contracts';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';

@Injectable()
export class MaintenanceScheduleService {
  private readonly logger = new Logger(MaintenanceScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    propertyId: string,
    query: QueryMaintenanceSchedulesDto,
  ): Promise<MaintenanceScheduleListResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.MaintenanceScheduleWhereInput = {
      propertyId,
      deletedAt: null,
      ...(query.assetId && { assetId: query.assetId }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    const [items, total] = await Promise.all([
      this.prisma.maintenanceSchedule.findMany({
        where,
        include: { asset: true },
        orderBy: [{ nextDueDate: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.maintenanceSchedule.count({ where }),
    ]);

    let dtos = items.map((s) => this.mapToDto(s));
    if (query.dueStatus) {
      dtos = dtos.filter((d) => d.dueStatus === query.dueStatus);
    }

    return {
      items: dtos,
      total,
      page,
      limit,
    };
  }

  async findById(propertyId: string, scheduleId: string): Promise<MaintenanceScheduleDto> {
    const schedule = await this.prisma.maintenanceSchedule.findFirst({
      where: { id: scheduleId, propertyId, deletedAt: null },
      include: { asset: true },
    });
    if (!schedule) {
      throw new NotFoundException(
        `Maintenance schedule '${scheduleId}' not found on property '${propertyId}'`,
      );
    }
    return this.mapToDto(schedule);
  }

  async create(
    propertyId: string,
    req: CreateMaintenanceScheduleRequest,
    actorId: string,
  ): Promise<MaintenanceScheduleDto> {
    if (!req.name?.trim()) {
      throw new BadRequestException('Schedule name is required');
    }
    if (!req.assetId) {
      throw new BadRequestException('Asset ID is required');
    }
    if (!req.nextDueDate) {
      throw new BadRequestException('Next due date is required');
    }

    const asset = await this.prisma.asset.findFirst({
      where: { id: req.assetId, propertyId, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException(`Asset '${req.assetId}' not found on property '${propertyId}'`);
    }

    const nextDueDate = new Date(`${req.nextDueDate.slice(0, 10)}T00:00:00.000Z`);

    return this.prisma.$transaction(async (tx) => {
      const schedule = await tx.maintenanceSchedule.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          assetId: req.assetId,
          name: req.name.trim(),
          description: req.description?.trim() || null,
          frequency: req.frequency || MaintenanceFrequency.MONTHLY,
          nextDueDate,
          isActive: true,
        },
        include: { asset: true },
      });

      const event = createCloudEvent({
        type: PmsEventType.ENGINEERING_SCHEDULE_CREATED,
        source: `https://pms.enterprise-hms.com/properties/${propertyId}/engineering/schedules/${schedule.id}`,
        subject: schedule.id,
        propertyId,
        data: {
          propertyId,
          scheduleId: schedule.id,
          assetId: schedule.assetId,
          name: schedule.name,
          frequency: schedule.frequency,
          nextDueDate: req.nextDueDate.slice(0, 10),
          createdBy: actorId,
          createdAt: schedule.createdAt.toISOString(),
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

      this.logger.log(`Maintenance schedule '${schedule.name}' created on property '${propertyId}'`);
      return this.mapToDto(schedule);
    });
  }

  async update(
    propertyId: string,
    scheduleId: string,
    req: UpdateMaintenanceScheduleRequest,
    actorId: string,
  ): Promise<MaintenanceScheduleDto> {
    return this.prisma.$transaction(async (tx) => {
      const schedule = await tx.maintenanceSchedule.findFirst({
        where: { id: scheduleId, propertyId, deletedAt: null },
      });
      if (!schedule) {
        throw new NotFoundException(
          `Maintenance schedule '${scheduleId}' not found on property '${propertyId}'`,
        );
      }

      const nextDueDate = req.nextDueDate
        ? new Date(`${req.nextDueDate.slice(0, 10)}T00:00:00.000Z`)
        : undefined;

      const res = await tx.maintenanceSchedule.updateMany({
        where: { id: scheduleId, propertyId, version: req.version, deletedAt: null },
        data: {
          ...(req.name !== undefined && { name: req.name.trim() }),
          ...(req.description !== undefined && { description: req.description?.trim() || null }),
          ...(req.frequency !== undefined && { frequency: req.frequency }),
          ...(nextDueDate !== undefined && { nextDueDate }),
          ...(req.isActive !== undefined && { isActive: req.isActive }),
          version: { increment: 1 },
        },
      });

      if (res.count === 0) {
        throw new ConflictException('Optimistic concurrency conflict while updating schedule');
      }

      const updated = await tx.maintenanceSchedule.findUniqueOrThrow({
        where: { id: scheduleId },
        include: { asset: true },
      });

      const event = createCloudEvent({
        type: PmsEventType.ENGINEERING_SCHEDULE_UPDATED,
        source: `https://pms.enterprise-hms.com/properties/${propertyId}/engineering/schedules/${updated.id}`,
        subject: updated.id,
        propertyId,
        data: {
          propertyId,
          scheduleId: updated.id,
          name: updated.name,
          frequency: updated.frequency,
          nextDueDate: updated.nextDueDate.toISOString().slice(0, 10),
          isActive: updated.isActive,
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

      this.logger.log(`Maintenance schedule '${updated.name}' updated on property '${propertyId}'`);
      return this.mapToDto(updated);
    });
  }

  private mapToDto(s: any): MaintenanceScheduleDto {
    const todayStr = new Date().toISOString().slice(0, 10);
    const dueStr = s.nextDueDate.toISOString().slice(0, 10);

    let dueStatus: ScheduleDueStatus = ScheduleDueStatus.UPCOMING;
    if (dueStr < todayStr) {
      dueStatus = ScheduleDueStatus.OVERDUE;
    } else if (dueStr === todayStr) {
      dueStatus = ScheduleDueStatus.DUE;
    }

    return {
      id: s.id,
      propertyId: s.propertyId,
      assetId: s.assetId,
      assetCode: s.asset?.code || null,
      assetName: s.asset?.name || null,
      name: s.name,
      description: s.description,
      frequency: s.frequency as MaintenanceFrequency,
      nextDueDate: dueStr,
      dueStatus,
      lastCompletedAt: s.lastCompletedAt?.toISOString() || null,
      isActive: s.isActive,
      version: s.version,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }
}

