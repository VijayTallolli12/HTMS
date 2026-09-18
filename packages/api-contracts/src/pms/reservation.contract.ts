import { RoomDto } from './room.contract';

export enum ReservationStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  NO_SHOW = 'NO_SHOW',
}

export interface GuestInputDto {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  identificationType?: string;
  identificationNumber?: string;
}

export interface GuestDto {
  id: string;
  propertyId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  identificationType?: string | null;
  identificationNumber?: string | null;
  crmProfileId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReservationDto {
  roomTypeId: string;
  ratePlanId: string;
  arrivalDate: string; // YYYY-MM-DD
  departureDate: string; // YYYY-MM-DD
  adultsCount: number;
  childrenCount?: number;
  guestId?: string;
  guest?: GuestInputDto;
  specialRequests?: string;
}

export interface CancelReservationDto {
  reason: string;
}

export interface ReservationRateNightDto {
  id: string;
  businessDate: string; // YYYY-MM-DD
  baseRateAmount: number;
  extraAdultRate: number;
  extraChildRate: number;
  totalAmount: number;
  currency: string;
}

export interface ReservationDto {
  id: string;
  propertyId: string;
  confirmationNumber: string;
  status: ReservationStatus;
  guestId: string;
  guest?: GuestDto;
  roomTypeId: string;
  roomTypeCode?: string;
  roomTypeName?: string;
  ratePlanId: string;
  ratePlanCode?: string;
  ratePlanName?: string;
  arrivalDate: string;
  departureDate: string;
  nightsCount: number;
  adultsCount: number;
  childrenCount: number;
  totalAmount: number;
  currency: string;
  specialRequests?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  assignedRoomId?: string | null;
  assignedAt?: string | null;
  assignedBy?: string | null;
  checkInAt?: string | null;
  checkedInBy?: string | null;
  assignedRoom?: RoomDto | null;
  version: number;
  rateNights?: ReservationRateNightDto[];
  createdAt: string;
  updatedAt: string;
}

export interface QueryReservationsDto {
  arrivalDate?: string;
  departureDate?: string;
  status?: ReservationStatus;
  roomTypeId?: string;
  guestName?: string;
  confirmationNumber?: string;
  page?: number;
  limit?: number;
}
