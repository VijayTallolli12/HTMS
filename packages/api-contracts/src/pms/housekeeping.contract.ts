// W1-T10: Housekeeping Task Contracts — Departure Cleaning Closed Loop

export enum HousekeepingTaskType {
  DEPARTURE = 'DEPARTURE',
}

export enum HousekeepingTaskPriority {
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum HousekeepingTaskStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  CLEANED = 'CLEANED',
  INSPECTED = 'INSPECTED',
  REJECTED = 'REJECTED',
}

export enum InspectionResult {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
}

export interface HousekeepingTaskDto {
  id: string;
  propertyId: string;
  roomId: string;
  roomNumber: string;
  reservationId: string | null;
  confirmationNumber: string | null;
  guestName: string | null;
  taskType: HousekeepingTaskType;
  priority: HousekeepingTaskPriority;
  status: HousekeepingTaskStatus;
  assignedAttendantId: string | null;
  assignedAttendantName: string | null;
  assignedBy: string | null;
  inspectionResult: InspectionResult | null;
  inspectionNotes: string | null;
  rejectionReason: string | null;
  startedAt: string | null;
  completedAt: string | null;
  inspectedAt: string | null;
  inspectedBy: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssignTaskRequest {
  assignedAttendantId: string;
}

export interface InspectTaskRequest {
  result: InspectionResult;
  notes?: string;
}

export interface QueryHousekeepingTasksDto {
  status?: HousekeepingTaskStatus;
  taskType?: HousekeepingTaskType;
  assignedAttendantId?: string;
  roomId?: string;
  page?: number;
  limit?: number;
}
