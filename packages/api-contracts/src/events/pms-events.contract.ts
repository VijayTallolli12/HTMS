// PMS Domain Events conforming to CloudEvents v1.0 & Event Catalog

export enum PmsEventType {
  ROOM_TYPE_CREATED = 'com.enterprise_hms.pms.room-type.created.v1',
  ROOM_TYPE_UPDATED = 'com.enterprise_hms.pms.room-type.updated.v1',
  ROOM_TYPE_DELETED = 'com.enterprise_hms.pms.room-type.deleted.v1',
  ROOM_CREATED = 'com.enterprise_hms.pms.room.created.v1',
  ROOM_UPDATED = 'com.enterprise_hms.pms.room.updated.v1',
  ROOM_DEACTIVATED = 'com.enterprise_hms.pms.room.deactivated.v1',
  RATE_PLAN_CREATED = 'com.enterprise_hms.pms.rate-plan.created.v1',
  RATE_PLAN_UPDATED = 'com.enterprise_hms.pms.rate-plan.updated.v1',
  DAILY_RATE_OVERRIDDEN = 'com.enterprise_hms.pms.daily-rate.overridden.v1',
  DAILY_INVENTORY_ADJUSTED = 'com.enterprise_hms.pms.daily-inventory.adjusted.v1',
  RESERVATION_CREATED = 'com.enterprise_hms.pms.reservation.created.v1',
  RESERVATION_CANCELLED = 'com.enterprise_hms.pms.reservation.cancelled.v1',
  ROOM_STATUS_CHANGED = 'com.enterprise_hms.pms.room.status_changed.v1',
  ROOM_MAINTENANCE_CREATED = 'com.enterprise_hms.pms.room.maintenance_block_created.v1',
  ROOM_MAINTENANCE_ENDED = 'com.enterprise_hms.pms.room.maintenance_block_ended.v1',
}

export interface RoomTypeCreatedData {
  roomTypeId: string;
  propertyId: string;
  code: string;
  name: string;
  roomClass: string;
  baseOccupancy: number;
  maxOccupancy: number;
}

export interface RoomTypeUpdatedData {
  roomTypeId: string;
  propertyId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface RoomCreatedData {
  roomId: string;
  propertyId: string;
  buildingId: string;
  floorId: string;
  roomTypeId: string;
  roomNumber: string;
}

export interface RoomUpdatedData {
  roomId: string;
  propertyId: string;
  previousRoomTypeId?: string;
  newRoomTypeId?: string;
  roomNumber?: string;
  isActive?: boolean;
}

export interface RatePlanCreatedData {
  ratePlanId: string;
  propertyId: string;
  code: string;
  name: string;
  currency: string;
  validFrom: string;
  validTo: string;
}

export interface DailyRateOverriddenData {
  ratePlanId: string;
  roomTypeId: string;
  propertyId: string;
  businessDate: string;
  baseRateAmount: number;
  isClosed?: boolean;
}

export interface DailyInventoryAdjustedData {
  propertyId: string;
  roomTypeId: string;
  businessDate: string;
  field:
    | 'total_rooms'
    | 'blocked_count'
    | 'booked_count'
    | 'out_of_order_count'
    | 'out_of_service_count'
    | 'overbooking_limit';
  delta: number;
  newValue: number;
}

export interface ReservationCreatedData {
  reservationId: string;
  propertyId: string;
  confirmationNumber: string;
  guestId: string;
  roomTypeId: string;
  ratePlanId: string;
  arrivalDate: string;
  departureDate: string;
  nightsCount: number;
  adultsCount: number;
  childrenCount: number;
  totalAmount: number;
  currency: string;
}

export interface ReservationCancelledData {
  reservationId: string;
  propertyId: string;
  confirmationNumber: string;
  roomTypeId: string;
  arrivalDate: string;
  departureDate: string;
  nightsCount: number;
  reason: string;
  cancelledAt: string;
}

export interface RoomStatusChangedData {
  propertyId: string;
  roomId: string;
  roomNumber: string;
  previousHousekeepingStatus?: string | null;
  newHousekeepingStatus?: string | null;
  previousServiceStatus?: string | null;
  newServiceStatus?: string | null;
  reason?: string | null;
  source: string;
  updatedBy: string;
}

export interface RoomMaintenanceCreatedData {
  propertyId: string;
  maintenanceBlockId: string;
  roomId: string;
  roomNumber?: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  createdBy: string;
}

export interface RoomMaintenanceEndedData {
  propertyId: string;
  maintenanceBlockId: string;
  roomId: string;
  roomNumber?: string;
  type: string;
  reason?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
}
