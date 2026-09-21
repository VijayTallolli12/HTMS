import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { HousekeepingTaskService } from '../../apps/api-core/src/modules/pms/housekeeping/services/housekeeping-task.service';

// Mock PrismaService
const mockPrisma = {
  housekeepingTask: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn((cb: any) => cb(mockPrisma)),
} as any;

// Mock RoomStatusService
const mockRoomStatusService = {
  transitionHousekeepingStatus: jest.fn(),
};

// Mock createCloudEvent
jest.mock('@hms/shared', () => ({
  createCloudEvent: jest.fn(() => ({
    id: 'event-id',
    specversion: '1.0',
    type: 'test',
    source: 'test',
    subject: 'test',
    datacontenttype: 'application/json',
    time: new Date().toISOString(),
    data: {},
    correlationid: undefined,
    causationid: undefined,
  })),
  generateUuidV7: jest.fn(() => 'uuid-v7-mock'),
}));

describe('HousekeepingTaskService', () => {
  let service: HousekeepingTaskService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HousekeepingTaskService(mockPrisma as any, mockRoomStatusService as any);
  });

  describe('State Machine', () => {
    it('should allow PENDING -> ASSIGNED', async () => {
      mockPrisma.housekeepingTask.findFirst.mockResolvedValue({
        id: 'task-1',
        propertyId: 'prop-1',
        roomId: 'room-1',
        status: 'PENDING',
        version: 0,
      });
      mockPrisma.housekeepingTask.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.housekeepingTask.findUniqueOrThrow.mockResolvedValue({
        id: 'task-1',
        propertyId: 'prop-1',
        roomId: 'room-1',
        status: 'ASSIGNED',
        version: 1,
        room: { roomNumber: '101' },
        reservation: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.claim('prop-1', 'task-1', 'user-1');
      expect(result.status).toBe('ASSIGNED');
    });

    it('should reject INSPECTED -> any (terminal state)', async () => {
      mockPrisma.housekeepingTask.findFirst.mockResolvedValue({
        id: 'task-1',
        propertyId: 'prop-1',
        status: 'INSPECTED',
        version: 0,
      });

      await expect(
        service.claim('prop-1', 'task-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject PENDING -> IN_PROGRESS (must be assigned first)', async () => {
      mockPrisma.housekeepingTask.findFirst.mockResolvedValue({
        id: 'task-1',
        propertyId: 'prop-1',
        status: 'PENDING',
        version: 0,
      });

      await expect(
        service.startCleaning('prop-1', 'task-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject ASSIGNED -> CLEANED (must start first)', async () => {
      mockPrisma.housekeepingTask.findFirst.mockResolvedValue({
        id: 'task-1',
        propertyId: 'prop-1',
        status: 'ASSIGNED',
        version: 0,
      });

      await expect(
        service.completeCleaning('prop-1', 'task-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('OCC / Concurrency', () => {
    it('should throw ConflictException on OCC failure', async () => {
      mockPrisma.housekeepingTask.findFirst.mockResolvedValue({
        id: 'task-1',
        propertyId: 'prop-1',
        status: 'PENDING',
        version: 0,
        assignedAttendantId: null,
      });
      mockPrisma.housekeepingTask.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.claim('prop-1', 'task-1', 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Assignment', () => {
    it('should prevent claiming task already assigned to another attendant', async () => {
      mockPrisma.housekeepingTask.findFirst.mockResolvedValue({
        id: 'task-1',
        propertyId: 'prop-1',
        status: 'ASSIGNED',
        version: 0,
        assignedAttendantId: 'other-user',
      });

      await expect(
        service.claim('prop-1', 'task-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow re-assigning an ASSIGNED task', async () => {
      mockPrisma.housekeepingTask.findFirst.mockResolvedValue({
        id: 'task-1',
        propertyId: 'prop-1',
        status: 'ASSIGNED',
        version: 0,
        assignedAttendantId: 'user-1',
      });
      mockPrisma.housekeepingTask.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.housekeepingTask.findUniqueOrThrow.mockResolvedValue({
        id: 'task-1',
        propertyId: 'prop-1',
        roomId: 'room-1',
        status: 'ASSIGNED',
        assignedAttendantId: 'user-2',
        version: 1,
        room: { roomNumber: '101' },
        reservation: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.assign('prop-1', 'task-1', 'user-2', 'supervisor-1');
      expect(result.assignedAttendantId).toBe('user-2');
    });
  });

  describe('Task Creation (Idempotency)', () => {
    it('should return existing task if one already exists for the reservation', async () => {
      const existingTask = { id: 'existing-task', reservationId: 'res-1' };
      mockPrisma.housekeepingTask.findFirst.mockResolvedValue(existingTask);

      const mockTx = {
        housekeepingTask: {
          findFirst: jest.fn().mockResolvedValue(existingTask),
          create: jest.fn(),
        },
        outboxEvent: { create: jest.fn() },
      };

      const result = await service.createDepartureTask(
        'prop-1',
        { roomId: 'room-1', reservationId: 'res-1', roomNumber: '101', confirmationNumber: 'CONF-1' },
        'user-1',
        mockTx as any,
      );

      expect(result.task).toBe(existingTask);
      expect(mockTx.housekeepingTask.create).not.toHaveBeenCalled();
    });
  });

  describe('NotFound', () => {
    it('should throw NotFoundException for non-existent task', async () => {
      mockPrisma.housekeepingTask.findFirst.mockResolvedValue(null);

      await expect(
        service.findById('prop-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
