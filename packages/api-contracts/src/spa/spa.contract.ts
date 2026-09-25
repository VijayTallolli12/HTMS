// ==============================================================================
// Enterprise HMS — Spa Operations Contracts
// ==============================================================================

export type SpaRoomType = 'SINGLE' | 'COUPLES' | 'HYDROTHERAPY' | 'FACIAL';

export type SpaRoomStatus = 'AVAILABLE' | 'OUT_OF_SERVICE';

export type SpaAppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type SpaSettlementType = 'ROOM_CHARGE' | 'DIRECT_PAY';

export type SpaPaymentMethod = 'ROOM_CHARGE' | 'CASH' | 'CREDIT_CARD';

export interface SpaServiceDto {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: string; // Decimal string
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpaServiceDto {
  code: string;
  name: string;
  description?: string;
  durationMinutes?: number;
  price: string | number;
  currency?: string;
  isActive?: boolean;
}

export interface UpdateSpaServiceDto {
  name?: string;
  description?: string;
  durationMinutes?: number;
  price?: string | number;
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

