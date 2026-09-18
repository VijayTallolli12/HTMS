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
