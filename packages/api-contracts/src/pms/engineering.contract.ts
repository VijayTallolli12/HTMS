/**
 * Engineering / Maintenance V1 contracts
 * Domain: property-scoped asset registry, maintenance work orders, preventive schedules.
 * Room operational impact is delegated to the existing PMS RoomMaintenanceBlock engine.
 */

// ── Enums ──────────────────────────────────────────────────────────

export enum WorkOrderStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
}

export enum WorkOrderPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum WorkOrderCategory {
  ELECTRICAL = 'ELECTRICAL',
  PLUMBING = 'PLUMBING',
  HVAC = 'HVAC',
  CARPENTRY = 'CARPENTRY',
  PAINTING = 'PAINTING',
  APPLIANCE = 'APPLIANCE',
  IT_NETWORK = 'IT_NETWORK',
  OTHER = 'OTHER',
}

export enum AssetStatus {
  ACTIVE = 'ACTIVE',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  INACTIVE = 'INACTIVE',
}

export enum MaintenanceFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
}

/** Derived urgency of a preventive schedule relative to the property business date. */
export enum ScheduleDueStatus {
  OVERDUE = 'OVERDUE',
  DUE = 'DUE',
  UPCOMING = 'UPCOMING',
}

// ── Assets ─────────────────────────────────────────────────────────

export interface AssetDto {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  category: string;
  status: AssetStatus;
  description: string | null;
  roomId: string | null;
  roomNumber: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetRequest {
  code: string;
  name: string;
  category: string;
  status?: AssetStatus;
  description?: string;
  roomId?: string;
}

export interface UpdateAssetRequest {
  name?: string;
  category?: string;
  status?: AssetStatus;
  description?: string | null;
  roomId?: string | null;
  /** Optimistic concurrency token */
  version: number;
}

export interface QueryAssetsDto {
  status?: AssetStatus;
  category?: string;
  roomId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ── Work Orders ────────────────────────────────────────────────────

export interface WorkOrderTechnicianDto {
  id: string;
  fullName: string;
}

export interface WorkOrderNoteDto {
  id: string;
  workOrderId: string;
  authorId: string;
  authorName: string | null;
  body: string;
  createdAt: string;
}

export interface WorkOrderDto {
  id: string;
  propertyId: string;
  code: string;
  title: string;
  description: string | null;
  priority: WorkOrderPriority;
  category: WorkOrderCategory;
  status: WorkOrderStatus;
  assetId: string | null;
  assetCode: string | null;
  assetName: string | null;
  roomId: string | null;
  roomNumber: string | null;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  maintenanceBlockId: string | null;
  reportedAt: string;
  dueAt: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  closedAt: string | null;
  completionNotes: string | null;
  reportedBy: string;
  isOverdue: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderDetailDto extends WorkOrderDto {
  notes: WorkOrderNoteDto[];
}

export interface CreateRoomBlockRequest {
  type: 'OUT_OF_ORDER' | 'OUT_OF_SERVICE';
  /** ISO 8601 date (yyyy-mm-dd) */
  startDate: string;
  /** ISO 8601 date (yyyy-mm-dd), exclusive end handled by the PMS engine */
  endDate: string;
  reason: string;
  notes?: string;
}

export interface CreateWorkOrderRequest {
  title: string;
  description?: string;
  priority: WorkOrderPriority;
  category: WorkOrderCategory;
  assetId?: string;
  roomId?: string;
  /** ISO 8601 datetime */
  dueAt?: string;
  /** Optionally assign a technician immediately (status becomes ASSIGNED) */
  assignToTechnicianId?: string;
  /**
   * Optionally create an OOO/OOS block for the linked room via the existing
   * PMS room maintenance engine (RoomMaintenanceBlock).
   */
  roomBlock?: CreateRoomBlockRequest;
}

export interface AssignWorkOrderRequest {
  technicianId: string;
}

export interface UpdateWorkOrderStatusRequest {
  status: WorkOrderStatus.IN_PROGRESS | WorkOrderStatus.COMPLETED;
  notes?: string;
}

export interface CloseWorkOrderRequest {
  notes?: string;
}

export interface AddWorkOrderNoteRequest {
  body: string;
}

export interface QueryWorkOrdersDto {
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  assignedTechnicianId?: string;
  roomId?: string;
  assetId?: string;
  overdue?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface EngineeringSummaryDto {
  open: number;
  assigned: number;
  inProgress: number;
  overdue: number;
  completedToday: number;
  roomsBlocked: number;
  schedulesDue: number;
}

// ── Preventive Maintenance Schedules ───────────────────────────────

export interface MaintenanceScheduleDto {
  id: string;
  propertyId: string;
  assetId: string;
  assetCode: string | null;
  assetName: string | null;
  name: string;
  description: string | null;
  frequency: MaintenanceFrequency;
  nextDueDate: string;
  dueStatus: ScheduleDueStatus;
  lastCompletedAt: string | null;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaintenanceScheduleRequest {
  assetId: string;
  name: string;
  description?: string;
  frequency: MaintenanceFrequency;
  /** ISO 8601 date (yyyy-mm-dd) */
  nextDueDate: string;
}

export interface UpdateMaintenanceScheduleRequest {
  name?: string;
  description?: string | null;
  frequency?: MaintenanceFrequency;
  nextDueDate?: string;
  isActive?: boolean;
  /** Optimistic concurrency token */
  version: number;
}

export interface QueryMaintenanceSchedulesDto {
  assetId?: string;
  isActive?: boolean;
  dueStatus?: ScheduleDueStatus;
  page?: number;
  limit?: number;
}

// ── List envelopes ─────────────────────────────────────────────────

export interface WorkOrderListResponse {
  items: WorkOrderDto[];
  total: number;
  page: number;
  limit: number;
}

export interface AssetListResponse {
  items: AssetDto[];
  total: number;
  page: number;
  limit: number;
}

export interface MaintenanceScheduleListResponse {
  items: MaintenanceScheduleDto[];
  total: number;
  page: number;
  limit: number;
}
