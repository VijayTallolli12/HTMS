import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import { RoomStatusService } from '../../room-operations/services/room-status.service';
import {
  HousekeepingTaskDto,
  HousekeepingTaskPriority,
  HousekeepingTaskStatus,
  HousekeepingTaskType,
  InspectionResult,
  PmsEventType,
} from '@hms/api-contracts';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';

const validTransitions: Record<string, string[]> = {
  [HousekeepingTaskStatus.PENDING]: [HousekeepingTaskStatus.ASSIGNED],
  [HousekeepingTaskStatus.ASSIGNED]: [HousekeepingTaskStatus.IN_PROGRESS, HousekeepingTaskStatus.PENDING],
  [HousekeepingTaskStatus.IN_PROGRESS]: [HousekeepingTaskStatus.CLEANED, HousekeepingTaskStatus.REJECTED],
  [HousekeepingTaskStatus.CLEANED]: [HousekeepingTaskStatus.INSPECTED, HousekeepingTaskStatus.REJECTED],
  [HousekeepingTaskStatus.INSPECTED]: [],
  [HousekeepingTaskStatus.REJECTED]: [HousekeepingTaskStatus.ASSIGNED],
};

const taskToRoomHkMap: Record<string, string> = {
  [HousekeepingTaskStatus.PENDING]: 'DIRTY',
  [HousekeepingTaskStatus.ASSIGNED]: 'DIRTY',
  [HousekeepingTaskStatus.IN_PROGRESS]: 'CLEANING',
  [HousekeepingTaskStatus.CLEANED]: 'CLEAN',
  [HousekeepingTaskStatus.INSPECTED]: 'INSPECTED',
  [HousekeepingTaskStatus.REJECTED]: 'DIRTY',
};

@Injectable()
export class HousekeepingTaskService {
  private readonly logger = new Logger(HousekeepingTaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly roomStatusService: RoomStatusService,
  ) {}

  async findAll(
    propertyId: string,
    query: {
      status?: HousekeepingTaskStatus;
      taskType?: HousekeepingTaskType;
      assignedAttendantId?: string;
      roomId?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ items: HousekeepingTaskDto[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.HousekeepingTaskWhereInput = {
      propertyId,
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.taskType && { taskType: query.taskType }),
      ...(query.assignedAttendantId && { assignedAttendantId: query.assignedAttendantId }),
      ...(query.roomId && { roomId: query.roomId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.housekeepingTask.findMany({
        where,
        include: { room: true, reservation: { include: { guest: true } } },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.housekeepingTask.count({ where }),
    ]);

    return {
      items: items.map((t) => this.mapToDto(t)),
      total,
      page,
      limit,
    };
  }

  async findById(propertyId: string, taskId: string): Promise<HousekeepingTaskDto> {
    const task = await this.prisma.housekeepingTask.findFirst({
      where: { id: taskId, propertyId, deletedAt: null },
      include: { room: true, reservation: { include: { guest: true } } },
    });
    if (!task) {
      throw new NotFoundException(`Housekeeping task '${taskId}' not found on property '${propertyId}'`);
    }
    return this.mapToDto(task);
  }

  async createDepartureTask(
    propertyId: string,
    data: {
      roomId: string;
      reservationId: string;
      roomNumber: string;
      confirmationNumber: string;
      assignedAttendantId?: string;
    },
    userId: string,
    tx: Prisma.TransactionClient,
  ): Promise<{ task: any }> {
    // Check for existing active departure task for this reservation
    const existing = await tx.housekeepingTask.findFirst({
      where: {
        propertyId,
        reservationId: data.reservationId,
        taskType: HousekeepingTaskType.DEPARTURE,
        deletedAt: null,
      },
    });

    if (existing) {
      this.logger.log(
        `Departure task already exists for reservation ${data.confirmationNumber}, skipping`,
      );
      return { task: existing };
    }

    const task = await tx.housekeepingTask.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        roomId: data.roomId,
        reservationId: data.reservationId,
        taskType: HousekeepingTaskType.DEPARTURE,
        priority: HousekeepingTaskPriority.NORMAL,
        status: data.assignedAttendantId
          ? HousekeepingTaskStatus.ASSIGNED
          : HousekeepingTaskStatus.PENDING,
        assignedAttendantId: data.assignedAttendantId || null,
        assignedBy: data.assignedAttendantId ? userId : null,
      },
    });

    // Emit HOUSEKEEPING_TASK_CREATED event
    const event = createCloudEvent({
      type: PmsEventType.HOUSEKEEPING_TASK_CREATED,
      source: `https://pms.enterprise-hms.com/properties/${propertyId}/housekeeping/tasks/${task.id}`,
      subject: task.id,
      propertyId,
      data: {
        propertyId,
        taskId: task.id,
        roomId: data.roomId,
        roomNumber: data.roomNumber,
        reservationId: data.reservationId,
        confirmationNumber: data.confirmationNumber,
        taskType: HousekeepingTaskType.DEPARTURE,
        assignedAttendantId: data.assignedAttendantId || null,
        createdAt: task.createdAt.toISOString(),
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

    this.logger.log(
      `Departure housekeeping task created for room ${data.roomNumber}, reservation ${data.confirmationNumber}`,
    );

    return { task };
  }

  async assign(
    propertyId: string,
    taskId: string,
    assignedAttendantId: string,
    userId: string,
  ): Promise<HousekeepingTaskDto> {
    return this.prisma.$transaction(
      async (tx) => {
        const task = await this.acquireTask(tx, propertyId, taskId);

        // Assign is allowed from PENDING→ASSIGNED or reassigning an already ASSIGNED task
        if (task.status !== HousekeepingTaskStatus.ASSIGNED) {
          this.validateTransition(task.status, HousekeepingTaskStatus.ASSIGNED);
        }

        const res = await tx.housekeepingTask.updateMany({
          where: { id: taskId, propertyId, version: task.version, deletedAt: null },
          data: {
            status: HousekeepingTaskStatus.ASSIGNED,
            assignedAttendantId,
            assignedBy: userId,
            version: { increment: 1 },
          },
        });

        if (res.count === 0) {
          throw new ConflictException('Optimistic concurrency conflict while assigning task');
        }

        const updated = await tx.housekeepingTask.findUniqueOrThrow({
          where: { id: taskId },
          include: { room: true, reservation: { include: { guest: true } } },
        });

        return this.mapToDto(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10000 },
    );
  }

  async claim(
    propertyId: string,
    taskId: string,
    userId: string,
  ): Promise<HousekeepingTaskDto> {
    return this.prisma.$transaction(
      async (tx) => {
        const task = await this.acquireTask(tx, propertyId, taskId);

        this.validateTransition(task.status, HousekeepingTaskStatus.ASSIGNED);

        if (task.assignedAttendantId && task.assignedAttendantId !== userId) {
          throw new ConflictException('Task is already assigned to another attendant');
        }

        const res = await tx.housekeepingTask.updateMany({
          where: { id: taskId, propertyId, version: task.version, deletedAt: null },
          data: {
            status: HousekeepingTaskStatus.ASSIGNED,
            assignedAttendantId: userId,
            assignedBy: userId,
            version: { increment: 1 },
          },
        });

        if (res.count === 0) {
          throw new ConflictException('Optimistic concurrency conflict while claiming task');
        }

        const updated = await tx.housekeepingTask.findUniqueOrThrow({
          where: { id: taskId },
          include: { room: true, reservation: { include: { guest: true } } },
        });

        return this.mapToDto(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10000 },
    );
  }

  async startCleaning(
    propertyId: string,
    taskId: string,
    userId: string,
  ): Promise<HousekeepingTaskDto> {
    return this.prisma.$transaction(
      async (tx) => {
        const task = await this.acquireTask(tx, propertyId, taskId);

        this.validateTransition(task.status, HousekeepingTaskStatus.IN_PROGRESS);

        if (task.assignedAttendantId !== userId) {
          throw new ConflictException('Only the assigned attendant can start cleaning');
        }

        // Transition room to CLEANING via T06 authority
        await this.roomStatusService.transitionHousekeepingStatus(
          propertyId,
          task.roomId,
          taskToRoomHkMap[HousekeepingTaskStatus.IN_PROGRESS] as any,
          { actorId: userId, source: 'HOUSEKEEPING_TASK', reason: 'Attendant started cleaning' },
          tx,
        );

        const res = await tx.housekeepingTask.updateMany({
          where: { id: taskId, propertyId, version: task.version, deletedAt: null },
          data: {
            status: HousekeepingTaskStatus.IN_PROGRESS,
            startedAt: new Date(),
            version: { increment: 1 },
          },
        });

        if (res.count === 0) {
          throw new ConflictException('Optimistic concurrency conflict while starting cleaning');
        }

        const updated = await tx.housekeepingTask.findUniqueOrThrow({
          where: { id: taskId },
          include: { room: true, reservation: { include: { guest: true } } },
        });

        return this.mapToDto(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10000 },
    );
  }

  async completeCleaning(
    propertyId: string,
    taskId: string,
    userId: string,
  ): Promise<HousekeepingTaskDto> {
    return this.prisma.$transaction(
      async (tx) => {
        const task = await this.acquireTask(tx, propertyId, taskId);

        this.validateTransition(task.status, HousekeepingTaskStatus.CLEANED);

        if (task.assignedAttendantId !== userId) {
          throw new ConflictException('Only the assigned attendant can complete cleaning');
        }

        // Transition room to CLEAN via T06 authority
        await this.roomStatusService.transitionHousekeepingStatus(
          propertyId,
          task.roomId,
          taskToRoomHkMap[HousekeepingTaskStatus.CLEANED] as any,
          { actorId: userId, source: 'HOUSEKEEPING_TASK', reason: 'Attendant completed cleaning' },
          tx,
        );

        const res = await tx.housekeepingTask.updateMany({
          where: { id: taskId, propertyId, version: task.version, deletedAt: null },
          data: {
            status: HousekeepingTaskStatus.CLEANED,
            completedAt: new Date(),
            version: { increment: 1 },
          },
        });

        if (res.count === 0) {
          throw new ConflictException('Optimistic concurrency conflict while completing cleaning');
        }

        const updated = await tx.housekeepingTask.findUniqueOrThrow({
          where: { id: taskId },
          include: { room: true, reservation: { include: { guest: true } } },
        });

        // Emit HOUSEKEEPING_TASK_COMPLETED event
        const event = createCloudEvent({
          type: PmsEventType.HOUSEKEEPING_TASK_COMPLETED,
          source: `https://pms.enterprise-hms.com/properties/${propertyId}/housekeeping/tasks/${task.id}`,
          subject: task.id,
          propertyId,
          data: {
            propertyId,
            taskId: task.id,
            roomId: task.roomId,
            roomNumber: (updated.room as any).roomNumber,
            completedBy: userId,
            completedAt: updated.completedAt?.toISOString() || new Date().toISOString(),
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

        return this.mapToDto(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10000 },
    );
  }

  async inspect(
    propertyId: string,
    taskId: string,
    result: InspectionResult,
    notes: string | undefined,
    userId: string,
  ): Promise<HousekeepingTaskDto> {
    return this.prisma.$transaction(
      async (tx) => {
        const task = await this.acquireTask(tx, propertyId, taskId);

        this.validateTransition(task.status, result === InspectionResult.PASSED
          ? HousekeepingTaskStatus.INSPECTED
          : HousekeepingTaskStatus.REJECTED);

        const targetTaskStatus = result === InspectionResult.PASSED
          ? HousekeepingTaskStatus.INSPECTED
          : HousekeepingTaskStatus.REJECTED;

        // Transition room via T06 authority
        const targetRoomHk = result === InspectionResult.PASSED
          ? taskToRoomHkMap[HousekeepingTaskStatus.INSPECTED]
          : taskToRoomHkMap[HousekeepingTaskStatus.REJECTED];
        await this.roomStatusService.transitionHousekeepingStatus(
          propertyId,
          task.roomId,
          targetRoomHk as any,
          {
            actorId: userId,
            source: 'HOUSEKEEPING_INSPECTION',
            reason: result === InspectionResult.PASSED
              ? 'Supervisor inspection passed'
              : `Supervisor inspection failed: ${notes || 'No notes'}`,
          },
          tx,
        );

        const res = await tx.housekeepingTask.updateMany({
          where: { id: taskId, propertyId, version: task.version, deletedAt: null },
          data: {
            status: targetTaskStatus,
            inspectionResult: result,
            inspectionNotes: notes || null,
            rejectionReason: result === InspectionResult.FAILED ? notes || 'Inspection failed' : null,
            inspectedAt: new Date(),
            inspectedBy: userId,
            version: { increment: 1 },
          },
        });

        if (res.count === 0) {
          throw new ConflictException('Optimistic concurrency conflict while inspecting task');
        }

        const updated = await tx.housekeepingTask.findUniqueOrThrow({
          where: { id: taskId },
          include: { room: true, reservation: { include: { guest: true } } },
        });

        // Emit HOUSEKEEPING_TASK_INSPECTED event
        const event = createCloudEvent({
          type: PmsEventType.HOUSEKEEPING_TASK_INSPECTED,
          source: `https://pms.enterprise-hms.com/properties/${propertyId}/housekeeping/tasks/${task.id}`,
          subject: task.id,
          propertyId,
          data: {
            propertyId,
            taskId: task.id,
            roomId: task.roomId,
            roomNumber: (updated.room as any).roomNumber,
            result,
            inspectedBy: userId,
            inspectedAt: updated.inspectedAt?.toISOString() || new Date().toISOString(),
            rejectionReason: result === InspectionResult.FAILED ? notes || null : null,
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

        return this.mapToDto(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10000 },
    );
  }

  private async acquireTask(
    tx: Prisma.TransactionClient,
    propertyId: string,
    taskId: string,
  ) {
    const task = await tx.housekeepingTask.findFirst({
      where: { id: taskId, propertyId, deletedAt: null },
    });
    if (!task) {
      throw new NotFoundException(`Housekeeping task '${taskId}' not found on property '${propertyId}'`);
    }
    return task;
  }

  private validateTransition(current: string, target: string) {
    const allowed = validTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Invalid task status transition from '${current}' to '${target}'. Allowed: [${allowed.join(', ')}]`,
      );
    }
  }

  private mapToDto(task: any): HousekeepingTaskDto {
    return {
      id: task.id,
      propertyId: task.propertyId,
      roomId: task.roomId,
      roomNumber: task.room?.roomNumber || '',
      reservationId: task.reservationId,
      confirmationNumber: task.reservation?.confirmationNumber || null,
      guestName: task.reservation?.guest
        ? `${task.reservation.guest.firstName} ${task.reservation.guest.lastName}`
        : null,
      taskType: task.taskType as HousekeepingTaskType,
      priority: task.priority as HousekeepingTaskPriority,
      status: task.status as HousekeepingTaskStatus,
      assignedAttendantId: task.assignedAttendantId,
      assignedAttendantName: null,
      assignedBy: task.assignedBy,
      inspectionResult: task.inspectionResult as InspectionResult | null,
      inspectionNotes: task.inspectionNotes,
      rejectionReason: task.rejectionReason,
      startedAt: task.startedAt?.toISOString() || null,
      completedAt: task.completedAt?.toISOString() || null,
      inspectedAt: task.inspectedAt?.toISOString() || null,
      inspectedBy: task.inspectedBy,
      version: task.version,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}
