// ==============================================================================
// Enterprise HMS — Spa Operations Contracts
// ==============================================================================

export enum SpaRoomType {
  SINGLE = 'SINGLE',
  COUPLES = 'COUPLES',
  HYDROTHERAPY = 'HYDROTHERAPY',
  FACIAL = 'FACIAL',
}

export enum SpaRoomStatus {
  AVAILABLE = 'AVAILABLE',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

export enum SpaAppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum SpaSettlementType {
  ROOM_CHARGE = 'ROOM_CHARGE',
  DIRECT_PAY = 'DIRECT_PAY',
}

export enum SpaPaymentMethod {
  ROOM_CHARGE = 'ROOM_CHARGE',
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
}

export enum SpaServiceAvailability {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
}

export interface SpaServiceCategoryDto {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpaServiceCategoryDto {
  code: string;
  name: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdateSpaServiceCategoryDto {
  name?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface SpaServiceDto {
  id: string;
  propertyId: string;
  categoryId?: string | null;
  categoryName?: string | null;
  code: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: string; // Decimal string
  currency: string;
  isActive: boolean;
  availability: SpaServiceAvailability;
  eligibleTherapistIds?: string | null; // JSON array of therapist IDs
  eligibleRoomTypes?: string | null; // JSON array of room types
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpaServiceDto {
  categoryId?: string;
  code: string;
  name: string;
  description?: string;
  durationMinutes?: number;
  price: string | number;
  currency?: string;
  isActive?: boolean;
  availability?: SpaServiceAvailability;
  eligibleTherapistIds?: string;
  eligibleRoomTypes?: string;
}

export interface UpdateSpaServiceDto {
  categoryId?: string;
  name?: string;
  description?: string;
  durationMinutes?: number;
  price?: string | number;
  currency?: string;
  isActive?: boolean;
  availability?: SpaServiceAvailability;
  eligibleTherapistIds?: string;
  eligibleRoomTypes?: string;
}

export interface SpaServiceDetailDto {
  id: string;
  propertyId: string;
  categoryId?: string | null;
  categoryName?: string | null;
  code: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: string;
  currency: string;
  availability: SpaServiceAvailability;
  isActive: boolean;
  eligibleTherapistIds?: string | null;
  eligibleRoomTypes?: string | null;
  createdAt: string;
  updatedAt: string;
  addons: SpaServiceAddonDto[];
}

export interface SpaServicePriceDto {
  id: string;
  code: string;
  name: string;
  basePrice: string;
  currency: string;
  availability: SpaServiceAvailability;
  durationMinutes: number;
  addons: SpaServiceAddonDto[];
}

export interface UpdateSpaServicePriceDto {
  price: string | number;
}

export interface UpdateSpaServiceAvailabilityDto {
  availability: SpaServiceAvailability;
}

export interface QuerySpaServicesDto {
  categoryId?: string;
  availability?: SpaServiceAvailability;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface SpaServiceAddonDto {
  id: string;
  propertyId: string;
  serviceId: string;
  code: string;
  name: string;
  description?: string | null;
  priceAdjustment: string;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpaServiceAddonDto {
  serviceId: string;
  code: string;
  name: string;
  description?: string;
  priceAdjustment?: string | number;
  currency?: string;
  isActive?: boolean;
}

export interface UpdateSpaServiceAddonDto {
  name?: string;
  description?: string;
  priceAdjustment?: string | number;
  currency?: string;
  isActive?: boolean;
}

export interface SpaTherapistDto {
  id: string;
  propertyId: string;
  name: string;
  specialty?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpaTherapistDto {
  name: string;
  specialty?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
}

export interface UpdateSpaTherapistDto {
  name?: string;
  specialty?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
}

export interface SpaRoomDto {
  id: string;
  propertyId: string;
  name: string;
  roomType: SpaRoomType;
  status: SpaRoomStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpaRoomDto {
  name: string;
  roomType?: SpaRoomType;
  status?: SpaRoomStatus;
}

export interface UpdateSpaRoomDto {
  name?: string;
  roomType?: SpaRoomType;
  status?: SpaRoomStatus;
}

export interface SpaAppointmentDto {
  id: string;
  propertyId: string;
  appointmentNumber: string;
  serviceId: string;
  serviceName?: string;
  therapistId: string;
  therapistName?: string;
  roomId: string;
  roomName?: string;
  startTime: string; // ISO-8601
  endTime: string; // ISO-8601
  durationMinutes: number;
  price: string; // Decimal string
  currency: string;
  status: SpaAppointmentStatus;
  guestName?: string | null;
  guestPhone?: string | null;
  roomNumber?: string | null;
  reservationId?: string | null;
  folioId?: string | null;
  folioTransactionId?: string | null;
  settlementType?: SpaSettlementType | null;
  paymentMethod?: SpaPaymentMethod | null;
  notes?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpaAppointmentDto {
  serviceId: string;
  therapistId: string;
  roomId: string;
  startTime: string; // ISO string
  guestName?: string;
  guestPhone?: string;
  roomNumber?: string;
  reservationId?: string;
  notes?: string;
}

export interface UpdateSpaAppointmentStatusDto {
  status: SpaAppointmentStatus;
  reason?: string;
}

export interface CompleteSpaAppointmentDto {
  settlementType: SpaSettlementType;
  paymentMethod?: SpaPaymentMethod;
  roomNumber?: string;
  reservationId?: string;
  folioId?: string;
}

export interface QuerySpaAppointmentsDto {
  date?: string; // YYYY-MM-DD
  startDate?: string;
  endDate?: string;
  status?: SpaAppointmentStatus;
  therapistId?: string;
  roomId?: string;
}

