import { ReservationDto } from './reservation.contract';
import { RoomStatusDto } from './room-operations.contract';

export interface AssignRoomDto {
  roomId: string;
  reason?: string;
  allowUpgrade?: boolean;
}

export interface UnassignRoomDto {
  reason?: string;
}

export interface CheckInDto {
  allowCleanOverride?: boolean;
  overrideReason?: string;
  identityVerified?: boolean;
  registrationCardSigned?: boolean;
}

export interface QueryEligibleRoomsDto {
  reservationId: string;
  includeDirty?: boolean;
  buildingId?: string;
  floorId?: string;
}

export interface EligibleRoomDto {
  id: string;
  propertyId: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeCode?: string;
  roomTypeName?: string;
  buildingId: string;
  floorId: string;
  housekeepingStatus: string;
  serviceStatus: string;
  occupancyStatus: string;
  isCheckInReady: boolean;
  isUpgrade: boolean;
}

export interface CheckInResponseDto {
  reservation: ReservationDto;
  room: RoomStatusDto;
  checkInAt: string;
  checkedInBy: string;
}

export interface ReservationAssignmentLogDto {
  id: string;
  propertyId: string;
  reservationId: string;
  previousRoomId: string | null;
  newRoomId: string | null;
  action: string;
  reason: string | null;
  actorId: string;
  createdAt: string;
}
