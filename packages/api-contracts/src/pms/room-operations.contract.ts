// W1-T06: Room Operations Status State Machine & Out-of-Order Engine Contracts

export enum HousekeepingStatus {
  DIRTY = 'DIRTY',
  CLEANING = 'CLEANING',
  CLEAN = 'CLEAN',
  INSPECTED = 'INSPECTED',
  PICKUP = 'PICKUP',
}

export enum RoomServiceStatus {
  IN_SERVICE = 'IN_SERVICE',
  OUT_OF_ORDER = 'OUT_OF_ORDER',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

export enum RoomOccupancyStatus {
  VACANT = 'VACANT',
  OCCUPIED = 'OCCUPIED',
}

export enum MaintenanceBlockType {
  OUT_OF_ORDER = 'OUT_OF_ORDER',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

export enum MaintenanceBlockStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum RoomStatusLogSource {
  MANUAL = 'MANUAL',
  MAINTENANCE_START = 'MAINTENANCE_START',
  MAINTENANCE_END = 'MAINTENANCE_END',
  RECONCILIATION_ACTIVATION = 'RECONCILIATION_ACTIVATION',
  RECONCILIATION_EXPIRY = 'RECONCILIATION_EXPIRY',
}

export interface EffectiveRoomStateDto {
  businessDate: string; // YYYY-MM-DD
  serviceStatus: RoomServiceStatus;
  housekeepingStatus: HousekeepingStatus;
  occupancyStatus: RoomOccupancyStatus;
  isCheckInReady: boolean;
  isSellable: boolean;
  activeMaintenanceBlockId?: string;
}

export interface RoomStatusDto {
  roomId: string;
  propertyId: string;
  roomNumber: string;
  roomTypeId: string;
  housekeepingStatus: HousekeepingStatus;
  serviceStatus: RoomServiceStatus;
  occupancyStatus: RoomOccupancyStatus;
  version: number;
  effective: EffectiveRoomStateDto;
}

export interface UpdateRoomStatusRequest {
  housekeepingStatus: HousekeepingStatus;
  reason?: string;
}

export interface CreateMaintenanceBlockRequest {
  roomId: string;
  type: MaintenanceBlockType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  notes?: string;
}

export interface CancelMaintenanceBlockRequest {
  reason: string;
}

export interface ReplaceMaintenanceBlockRequest {
  newType: MaintenanceBlockType;
  reason: string;
  notes?: string;
}

export interface MaintenanceBlockDto {
  id: string;
  propertyId: string;
  roomId: string;
  roomNumber?: string;
  type: MaintenanceBlockType;
  reason: string;
  notes?: string | null;
  startDate: string;
  endDate: string;
  status: MaintenanceBlockStatus;
  createdBy: string;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceBlockResponseDto {
  maintenanceBlock: MaintenanceBlockDto;
  advisory?: {
    hasOverbookingRisk: boolean;
    affectedDates: string[];
    message: string;
  };
}

export interface RoomStatusLogDto {
  id: string;
  propertyId: string;
  roomId: string;
  previousHousekeepingStatus?: string | null;
  newHousekeepingStatus?: string | null;
  previousServiceStatus?: string | null;
  newServiceStatus?: string | null;
  reason?: string | null;
  source: string;
  changedBy: string;
  createdAt: string;
}

export interface QueryRoomStatusDto {
  buildingId?: string;
  floorId?: string;
  roomTypeId?: string;
  housekeepingStatus?: HousekeepingStatus;
  serviceStatus?: RoomServiceStatus;
}

export interface QueryMaintenanceBlocksDto {
  roomId?: string;
  type?: MaintenanceBlockType;
  status?: MaintenanceBlockStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// Occupancy Board (W4) — rich per-room cards built from real domain data.
// Every field is sourced from actual reservations/guests/folios/F&B/spa
// records; amounts are always in the property currency.
// ============================================================================

export interface OccupancyRoomCard {
  roomId: string;
  roomNumber: string;
  floorId: string;
  status: 'OCCUPIED' | 'VACANT' | 'DIRTY' | 'CLEAN' | 'INSPECTED' | 'OUT_OF_ORDER' | 'OUT_OF_SERVICE';
  occupancyStatus: string;
  housekeepingStatus: string;
  serviceStatus: string;
  housekeepingTaskActive: string | null;
  maintenance: { type: string; reason: string | null; endDate: string } | null;
  roomType: { id: string; code: string; name: string; bedConfiguration: Record<string, unknown> | null };
  guest: { name: string; isLoyaltyMember: boolean } | null;
  stay: { confirmationNumber: string; arrivalDate: string; departureDate: string } | null;
  folio: { balance: number; currency: string; status: string } | null;
  fnb: { orders: number; total: number; currency: string; hasActiveOrder: boolean } | null;
  spa: { bookings: number; total: number; currency: string; upcoming: number } | null;
}

export interface OccupancyBoard {
  businessDate: string;
  currency: string;
  timeZone: string;
  summary: { total: number; occupied: number; vacant: number; dirty: number; outOfOrder: number };
  rooms: OccupancyRoomCard[];
}
