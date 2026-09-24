import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import { RoomMaintenanceService } from '../../room-operations/services/room-maintenance.service';
import {
  AddWorkOrderNoteRequest,
  AssignWorkOrderRequest,
  CloseWorkOrderRequest,
  CreateWorkOrderRequest,
  EngineeringSummaryDto,
  PmsEventType,
  QueryWorkOrdersDto,
  UpdateWorkOrderStatusRequest,
  WorkOrderDetailDto,
  WorkOrderDto,
  WorkOrderListResponse,
  WorkOrderNoteDto,
  WorkOrderPriority,
  WorkOrderStatus,
  MaintenanceBlockType,
} from '@hms/api-contracts';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';

const validTransitions: Record<string, string[]> = {
  [WorkOrderStatus.OPEN]: [WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS],
  [WorkOrderStatus.ASSIGNED]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ASSIGNED],
  [WorkOrderStatus.IN_PROGRESS]: [WorkOrderStatus.COMPLETED],
  [WorkOrderStatus.COMPLETED]: [WorkOrderStatus.CLOSED],
  [WorkOrderStatus.CLOSED]: [],
};

@Injectable()
export class WorkOrderService {
  private readonly logger = new Logger(WorkOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly roomMaintenanceService: RoomMaintenanceService,
  ) {}

  async findAll(
    propertyId: string,
    query: QueryWorkOrdersDto,
  ): Promise<WorkOrderListResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const now = new Date();
    const where: Prisma.WorkOrderWhereInput = {
      propertyId,
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.priority && { priority: query.priority }),
      ...(query.assignedTechnicianId && { assignedTechnicianId: query.assignedTechnicianId }),
      ...(query.roomId && { roomId: query.roomId }),
      ...(query.assetId && { assetId: query.assetId }),
      ...(query.overdue === true && {
        dueAt: { lt: now },
        status: { notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CLOSED] },
      }),
      ...(query.search && {
        OR: [
          { code: { contains: query.search, mode: 'insensitive' } },
          { title: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        include: { room: true, asset: true },
        orderBy: [{ reportedAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.workOrder.count({ where }),
    ]);

    // Resolve technician names in batch
    const technicianIds = Array.from(
      new Set(items.map((i) => i.assignedTechnicianId).filter(Boolean)),
    ) as string[];

    const technicians = technicianIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: technicianIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];

    const techMap = new Map(
      technicians.map((t) => [t.id, `${t.firstName} ${t.lastName}`.trim()]),
    );

    return {
      items: items.map((w) => this.mapToDto(w, techMap)),
      total,
      page,
      limit,
    };
  }

  async getSummary(propertyId: string): Promise<EngineeringSummaryDto> {
    const now = new Date();
    const todayMidnight = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z');

    const [open, assigned, inProgress, overdue, completedToday, roomsBlocked, schedulesDue] =
      await Promise.all([
        this.prisma.workOrder.count({
          where: { propertyId, status: WorkOrderStatus.OPEN, deletedAt: null },
        }),
        this.prisma.workOrder.count({
          where: { propertyId, status: WorkOrderStatus.ASSIGNED, deletedAt: null },
        }),
        this.prisma.workOrder.count({
          where: { propertyId, status: WorkOrderStatus.IN_PROGRESS, deletedAt: null },
        }),
        this.prisma.workOrder.count({
          where: {
            propertyId,
            dueAt: { lt: now },
            status: { notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CLOSED] },
            deletedAt: null,
          },
        }),
        this.prisma.workOrder.count({
          where: {
            propertyId,
            status: { in: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CLOSED] },
            completedAt: { gte: todayMidnight },
            deletedAt: null,
          },
        }),
        this.prisma.roomMaintenanceBlock.count({
          where: {
            propertyId,
            status: 'ACTIVE',
            deletedAt: null,
            startDate: { lte: now },
            endDate: { gt: now },
          },
        }),
        this.prisma.maintenanceSchedule.count({
          where: {
            propertyId,
            isActive: true,
            nextDueDate: { lte: now },
            deletedAt: null,
          },
        }),
      ]);

    return {
      open,
      assigned,
      inProgress,
      overdue,
      completedToday,
      roomsBlocked,
      schedulesDue,
    };
  }

  async findById(propertyId: string, workOrderId: string): Promise<WorkOrderDetailDto> {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, propertyId, deletedAt: null },
      include: {
        room: true,
        asset: true,
        notes: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(
        `Work order '${workOrderId}' not found on property '${propertyId}'`,
      );
    }

    let technicianName: string | null = null;
    if (workOrder.assignedTechnicianId) {
      const tech = await this.prisma.user.findUnique({
        where: { id: workOrder.assignedTechnicianId },
        select: { firstName: true, lastName: true },
      });
      if (tech) {
        technicianName = `${tech.firstName} ${tech.lastName}`.trim();
      }
    }

    // Resolve author names for notes
    const authorIds = Array.from(new Set(workOrder.notes.map((n) => n.authorId)));
    const authors = authorIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const authorMap = new Map(
      authors.map((a) => [a.id, `${a.firstName} ${a.lastName}`.trim()]),
    );

    const baseDto = this.mapToDto(workOrder, new Map(
      workOrder.assignedTechnicianId && technicianName
        ? [[workOrder.assignedTechnicianId, technicianName]]
        : [],
    ));

    const notes: WorkOrderNoteDto[] = workOrder.notes.map((n) => ({
      id: n.id,
      workOrderId: n.workOrderId,
      authorId: n.authorId,
      authorName: authorMap.get(n.authorId) || null,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    }));

    return {
      ...baseDto,
      notes,
    };
  }

  async create(
    propertyId: string,
    req: CreateWorkOrderRequest,
    actorId: string,
  ): Promise<WorkOrderDto> {
    if (!req.title?.trim()) {
      throw new BadRequestException('Work order title is required');
    }

    if (req.assetId) {
      const asset = await this.prisma.asset.findFirst({
        where: { id: req.assetId, propertyId, deletedAt: null },
      });
      if (!asset) {
        throw new NotFoundException(`Asset '${req.assetId}' not found on property '${propertyId}'`);
      }
    }

    if (req.roomId) {
      const room = await this.prisma.room.findFirst({
        where: { id: req.roomId, propertyId, deletedAt: null },
      });
      if (!room) {
        throw new NotFoundException(`Room '${req.roomId}' not found on property '${propertyId}'`);
      }
    }

    if (req.assignToTechnicianId) {
      const tech = await this.prisma.user.findUnique({
        where: { id: req.assignToTechnicianId },
      });
      if (!tech) {
        throw new NotFoundException(`Technician user '${req.assignToTechnicianId}' not found`);
      }
    }

    // Optional Room Maintenance Block Integration via T06 authority
    let maintenanceBlockId: string | null = null;
    if (req.roomBlock && req.roomId) {
      const blockRes = await this.roomMaintenanceService.create(
        propertyId,
        {
          roomId: req.roomId,
          type: req.roomBlock.type as MaintenanceBlockType,
          startDate: req.roomBlock.startDate,
          endDate: req.roomBlock.endDate,
          reason: req.roomBlock.reason || `Work Order: ${req.title}`,
          notes: req.roomBlock.notes || req.description,
        },
        actorId,
      );
      maintenanceBlockId = blockRes.maintenanceBlock.id;
    }

    // Generate human-readable code: WO-YYMMDD-XXXX
    const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const count = await this.prisma.workOrder.count({ where: { propertyId } });
    const code = `WO-${datePart}-${String(count + 1).padStart(4, '0')}`;

    const isAssigned = !!req.assignToTechnicianId;
    const initialStatus = isAssigned ? WorkOrderStatus.ASSIGNED : WorkOrderStatus.OPEN;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          code,
          title: req.title.trim(),
          description: req.description?.trim() || null,
          priority: req.priority || WorkOrderPriority.MEDIUM,
          category: req.category,
          status: initialStatus,
          assetId: req.assetId || null,
          roomId: req.roomId || null,
          assignedTechnicianId: req.assignToTechnicianId || null,
          maintenanceBlockId,
          dueAt: req.dueAt ? new Date(req.dueAt) : null,
          assignedAt: isAssigned ? now : null,
          reportedBy: actorId,
        },
        include: { room: true, asset: true },
      });

      const event = createCloudEvent({
        type: PmsEventType.ENGINEERING_WORK_ORDER_CREATED,
        source: `https://pms.enterprise-hms.com/properties/${propertyId}/engineering/work-orders/${workOrder.id}`,
        subject: workOrder.id,
        propertyId,
        data: {
          propertyId,
          workOrderId: workOrder.id,
          code: workOrder.code,
          title: workOrder.title,
          priority: workOrder.priority,
          category: workOrder.category,
          status: workOrder.status,
          roomId: workOrder.roomId,
          assetId: workOrder.assetId,
          assignedTechnicianId: workOrder.assignedTechnicianId,
          reportedBy: workOrder.reportedBy,
          createdAt: workOrder.createdAt.toISOString(),
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

      if (isAssigned) {
        const assignEvent = createCloudEvent({
          type: PmsEventType.ENGINEERING_WORK_ORDER_ASSIGNED,
          source: `https://pms.enterprise-hms.com/properties/${propertyId}/engineering/work-orders/${workOrder.id}`,
          subject: workOrder.id,
          propertyId,
          data: {
            propertyId,
            workOrderId: workOrder.id,
            code: workOrder.code,
            technicianId: workOrder.assignedTechnicianId,
            assignedBy: actorId,
            assignedAt: now.toISOString(),
          },
        });

        await tx.outboxEvent.create({
          data: {
            id: assignEvent.id,
            specversion: assignEvent.specversion,
            type: assignEvent.type,
            source: assignEvent.source,
            subject: assignEvent.subject,
            propertyId,
            datacontenttype: assignEvent.datacontenttype,
            time: new Date(assignEvent.time),
            data: assignEvent.data as any,
            correlationId: assignEvent.correlationid,
            causationId: assignEvent.causationid,
          },
        });
      }

      this.logger.log(`Work order '${workOrder.code}' created on property '${propertyId}'`);
      return this.mapToDto(workOrder, new Map());
    });
  }

  async assign(
    propertyId: string,
    workOrderId: string,
    req: AssignWorkOrderRequest,
    actorId: string,
  ): Promise<WorkOrderDto> {
    if (!req.technicianId) {
      throw new BadRequestException('Technician ID is required');
    }

    const tech = await this.prisma.user.findUnique({
      where: { id: req.technicianId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!tech) {
      throw new NotFoundException(`Technician user '${req.technicianId}' not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.findFirst({
        where: { id: workOrderId, propertyId, deletedAt: null },
      });
      if (!workOrder) {
        throw new NotFoundException(`Work order '${workOrderId}' not found on property '${propertyId}'`);
      }

      if (workOrder.status !== WorkOrderStatus.OPEN && workOrder.status !== WorkOrderStatus.ASSIGNED) {
        throw new BadRequestException(
          `Cannot assign work order with status '${workOrder.status}'. Only OPEN or ASSIGNED can be assigned.`,
        );
      }

      const now = new Date();
      const res = await tx.workOrder.updateMany({
        where: { id: workOrderId, propertyId, version: workOrder.version, deletedAt: null },
        data: {
          status: WorkOrderStatus.ASSIGNED,
          assignedTechnicianId: req.technicianId,
          assignedAt: now,
          version: { increment: 1 },
        },
      });

      if (res.count === 0) {
        throw new ConflictException('Optimistic concurrency conflict while assigning work order');
      }

      const updated = await tx.workOrder.findUniqueOrThrow({
        where: { id: workOrderId },
        include: { room: true, asset: true },
      });

      const assignEvent = createCloudEvent({
        type: PmsEventType.ENGINEERING_WORK_ORDER_ASSIGNED,
        source: `https://pms.enterprise-hms.com/properties/${propertyId}/engineering/work-orders/${updated.id}`,
        subject: updated.id,
        propertyId,
        data: {
          propertyId,
          workOrderId: updated.id,
          code: updated.code,
          technicianId: req.technicianId,
          assignedBy: actorId,
          assignedAt: now.toISOString(),
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: assignEvent.id,
          specversion: assignEvent.specversion,
          type: assignEvent.type,
          source: assignEvent.source,
          subject: assignEvent.subject,
          propertyId,
          datacontenttype: assignEvent.datacontenttype,
          time: new Date(assignEvent.time),
          data: assignEvent.data as any,
          correlationId: assignEvent.correlationid,
          causationId: assignEvent.causationid,
        },
      });

      const techMap = new Map([[tech.id, `${tech.firstName} ${tech.lastName}`.trim()]]);
      return this.mapToDto(updated, techMap);
    });
  }

  async updateStatus(
    propertyId: string,
    workOrderId: string,
    req: UpdateWorkOrderStatusRequest,
    actorId: string,
  ): Promise<WorkOrderDto> {
    return this.prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.findFirst({
        where: { id: workOrderId, propertyId, deletedAt: null },
      });
      if (!workOrder) {
        throw new NotFoundException(`Work order '${workOrderId}' not found on property '${propertyId}'`);
      }

      this.validateTransition(workOrder.status, req.status);

      const now = new Date();
      const updateData: Prisma.WorkOrderUpdateInput = {
        version: { increment: 1 },
        status: req.status,
      };

      if (req.status === WorkOrderStatus.IN_PROGRESS) {
        updateData.startedAt = now;
      } else if (req.status === WorkOrderStatus.COMPLETED) {
        updateData.completedAt = now;
        if (req.notes) {
          updateData.completionNotes = req.notes.trim();
        }
      }

      const res = await tx.workOrder.updateMany({
        where: { id: workOrderId, propertyId, version: workOrder.version, deletedAt: null },
        data: {
          status: req.status,
          ...(req.status === WorkOrderStatus.IN_PROGRESS ? { startedAt: now } : {}),
          ...(req.status === WorkOrderStatus.COMPLETED
            ? { completedAt: now, completionNotes: req.notes?.trim() || null }
            : {}),
          version: { increment: 1 },
        },
      });

      if (res.count === 0) {
        throw new ConflictException('Optimistic concurrency conflict while updating status');
      }

      const updated = await tx.workOrder.findUniqueOrThrow({
        where: { id: workOrderId },
        include: { room: true, asset: true },
      });

      const event = createCloudEvent({
        type: PmsEventType.ENGINEERING_WORK_ORDER_STATUS_CHANGED,
        source: `https://pms.enterprise-hms.com/properties/${propertyId}/engineering/work-orders/${updated.id}`,
        subject: updated.id,
        propertyId,
        data: {
          propertyId,
          workOrderId: updated.id,
          code: updated.code,
          previousStatus: workOrder.status,
          newStatus: updated.status,
          updatedBy: actorId,
          updatedAt: now.toISOString(),
          completionNotes: updated.completionNotes,
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

      let techMap = new Map<string, string>();
      if (updated.assignedTechnicianId) {
        const tech = await tx.user.findUnique({
          where: { id: updated.assignedTechnicianId },
          select: { id: true, firstName: true, lastName: true },
        });
        if (tech) {
          techMap.set(tech.id, `${tech.firstName} ${tech.lastName}`.trim());
        }
      }

      return this.mapToDto(updated, techMap);
    });
  }

  async close(
    propertyId: string,
    workOrderId: string,
    req: CloseWorkOrderRequest,
    actorId: string,
  ): Promise<WorkOrderDto> {
    return this.prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.findFirst({
        where: { id: workOrderId, propertyId, deletedAt: null },
      });
      if (!workOrder) {
        throw new NotFoundException(`Work order '${workOrderId}' not found on property '${propertyId}'`);
      }

      this.validateTransition(workOrder.status, WorkOrderStatus.CLOSED);

      const now = new Date();
      const res = await tx.workOrder.updateMany({
        where: { id: workOrderId, propertyId, version: workOrder.version, deletedAt: null },
        data: {
          status: WorkOrderStatus.CLOSED,
          closedAt: now,
          closedBy: actorId,
          ...(req.notes ? { completionNotes: req.notes.trim() } : {}),
          version: { increment: 1 },
        },
      });

      if (res.count === 0) {
        throw new ConflictException('Optimistic concurrency conflict while closing work order');
      }

      const updated = await tx.workOrder.findUniqueOrThrow({
        where: { id: workOrderId },
        include: { room: true, asset: true },
      });

      const event = createCloudEvent({
        type: PmsEventType.ENGINEERING_WORK_ORDER_STATUS_CHANGED,
        source: `https://pms.enterprise-hms.com/properties/${propertyId}/engineering/work-orders/${updated.id}`,
        subject: updated.id,
        propertyId,
        data: {
          propertyId,
          workOrderId: updated.id,
          code: updated.code,
          previousStatus: workOrder.status,
          newStatus: updated.status,
          updatedBy: actorId,
          updatedAt: now.toISOString(),
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

      let techMap = new Map<string, string>();
      if (updated.assignedTechnicianId) {
        const tech = await tx.user.findUnique({
          where: { id: updated.assignedTechnicianId },
          select: { id: true, firstName: true, lastName: true },
        });
        if (tech) {
          techMap.set(tech.id, `${tech.firstName} ${tech.lastName}`.trim());
        }
      }

      return this.mapToDto(updated, techMap);
    });
  }

  async addNote(
    propertyId: string,
    workOrderId: string,
    req: AddWorkOrderNoteRequest,
    actorId: string,
  ): Promise<WorkOrderNoteDto> {
    if (!req.body?.trim()) {
      throw new BadRequestException('Note body is required');
    }

    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, propertyId, deletedAt: null },
    });
    if (!workOrder) {
      throw new NotFoundException(`Work order '${workOrderId}' not found on property '${propertyId}'`);
    }

    const note = await this.prisma.workOrderNote.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        workOrderId,
        authorId: actorId,
        body: req.body.trim(),
      },
    });

    const author = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { firstName: true, lastName: true },
    });

    return {
      id: note.id,
      workOrderId: note.workOrderId,
      authorId: note.authorId,
      authorName: author ? `${author.firstName} ${author.lastName}`.trim() : null,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
    };
  }

  private validateTransition(current: string, target: string) {
    const allowed = validTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Invalid work order transition from '${current}' to '${target}'. Allowed: [${allowed.join(', ')}]`,
      );
    }
  }

  private mapToDto(wo: any, techMap: Map<string, string>): WorkOrderDto {
    const now = new Date();
    const isOverdue = !!(
      wo.dueAt &&
      wo.dueAt < now &&
      wo.status !== WorkOrderStatus.COMPLETED &&
      wo.status !== WorkOrderStatus.CLOSED
    );

    return {
      id: wo.id,
      propertyId: wo.propertyId,
      code: wo.code,
      title: wo.title,
      description: wo.description,
      priority: wo.priority as WorkOrderPriority,
      category: wo.category,
      status: wo.status as WorkOrderStatus,
      assetId: wo.assetId,
      assetCode: wo.asset?.code || null,
      assetName: wo.asset?.name || null,
      roomId: wo.roomId,
      roomNumber: wo.room?.roomNumber || null,
      assignedTechnicianId: wo.assignedTechnicianId,
      assignedTechnicianName: wo.assignedTechnicianId
        ? techMap.get(wo.assignedTechnicianId) || null
        : null,
      maintenanceBlockId: wo.maintenanceBlockId,
      reportedAt: wo.reportedAt.toISOString(),
      dueAt: wo.dueAt?.toISOString() || null,
      assignedAt: wo.assignedAt?.toISOString() || null,
      startedAt: wo.startedAt?.toISOString() || null,
      completedAt: wo.completedAt?.toISOString() || null,
      closedAt: wo.closedAt?.toISOString() || null,
      completionNotes: wo.completionNotes,
      reportedBy: wo.reportedBy,
      isOverdue,
      version: wo.version,
      createdAt: wo.createdAt.toISOString(),
      updatedAt: wo.updatedAt.toISOString(),
    };
  }
}

