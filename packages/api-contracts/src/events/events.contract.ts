// ==============================================================================
// Enterprise HMS — Events & Banquets Contracts
// ==============================================================================

export type EventVenueType =
  | 'BALLROOM'
  | 'MEETING_ROOM'
  | 'OUTDOOR'
  | 'BANQUET_HALL'
  | 'BOARDROOM';

export type EventResourceType =
  | 'AUDIO_VISUAL'
  | 'FURNITURE'
  | 'LIGHTING'
  | 'CATERING_EQUIPMENT'
  | 'STAGING';

export type EventBookingStatus =
  | 'DRAFT'
  | 'TENTATIVE'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type EventBookingType =
  | 'WEDDING'
  | 'CONFERENCE'
  | 'BANQUET'
  | 'MEETING'
  | 'SOCIAL'
  | 'EXHIBITION'
  | 'OTHER';

export type EventSettlementType = 'ROOM_CHARGE' | 'DIRECT_PAY';

export type EventPaymentMethod =
  | 'ROOM_CHARGE'
  | 'CASH'
  | 'CREDIT_CARD'
  | 'BANK_TRANSFER'
  | 'CORPORATE_INVOICE';

// ==========================================
// VENUES
// ==========================================
export interface EventVenueDto {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  venueType: EventVenueType;
  capacity: number;
  location?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventVenueDto {
  code: string;
  name: string;
  venueType?: EventVenueType;
  capacity: number;
  location?: string;
  isActive?: boolean;
}

export interface UpdateEventVenueDto {
  name?: string;
  venueType?: EventVenueType;
  capacity?: number;
  location?: string;
  isActive?: boolean;
}

// ==========================================
// PACKAGES
// ==========================================
export interface EventPackageDto {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  description?: string | null;
  pricePerGuest: string; // Decimal string
  currency: string;
  minGuests: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventPackageDto {
  code: string;
  name: string;
  description?: string;
  pricePerGuest: string | number;
  currency?: string;
  minGuests?: number;
  isActive?: boolean;
}

export interface UpdateEventPackageDto {
  name?: string;
  description?: string;
  pricePerGuest?: string | number;
  currency?: string;
  minGuests?: number;
  isActive?: boolean;
}

// ==========================================
// RESOURCES & ALLOCATIONS
// ==========================================
export interface EventResourceDto {
  id: string;
  propertyId: string;
  name: string;
  resourceType: EventResourceType;
  totalQuantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventResourceDto {
  name: string;
  resourceType?: EventResourceType;
  totalQuantity: number;
  isActive?: boolean;
}

export interface UpdateEventResourceDto {
  name?: string;
  resourceType?: EventResourceType;
  totalQuantity?: number;
  isActive?: boolean;
}

export interface EventBookingResourceDto {
  id: string;
  bookingId: string;
  resourceId: string;
  resourceName?: string;
  resourceType?: EventResourceType;
  quantity: number;
  notes?: string | null;
  createdAt: string;
}

export interface AllocateResourceDto {
  resourceId: string;
  quantity: number;
  notes?: string;
}

export interface AllocateResourcesDto {
  allocations: AllocateResourceDto[];
}

// ==========================================
// BOOKINGS
// ==========================================
export interface EventBookingDto {
  id: string;
  propertyId: string;
  bookingNumber: string;
  venueId: string;
  venueName?: string;
  venueCapacity?: number;
  packageId?: string | null;
  packageName?: string;
  hostName: string;
  hostEmail?: string | null;
  hostPhone?: string | null;
  eventName: string;
  eventType: EventBookingType;
  startTime: string; // ISO-8601
  endTime: string; // ISO-8601
  expectedGuests: number;
  estimatedAmount: string; // Decimal string
  currency: string;
  status: EventBookingStatus;
  notes?: string | null;
  roomNumber?: string | null;
  reservationId?: string | null;
  folioId?: string | null;
  folioTransactionId?: string | null;
  settlementType?: EventSettlementType | null;
  paymentMethod?: EventPaymentMethod | null;
  completedAt?: string | null;
  completedBy?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  resourceAllocations?: EventBookingResourceDto[];
}

export interface CreateEventBookingDto {
  venueId: string;
  packageId?: string;
  hostName: string;
  hostEmail?: string;
  hostPhone?: string;
  eventName: string;
  eventType?: EventBookingType;
  startTime: string; // ISO string
  endTime: string; // ISO string
  expectedGuests: number;
  estimatedAmount?: string | number;
  notes?: string;
  roomNumber?: string;
  reservationId?: string;
}

export interface UpdateEventBookingStatusDto {
  status: EventBookingStatus;
  reason?: string;
}

export interface CompleteEventBookingDto {
  settlementType: EventSettlementType;
  paymentMethod?: EventPaymentMethod;
  roomNumber?: string;
  reservationId?: string;
  folioId?: string;
}

export interface QueryEventBookingsDto {
  date?: string; // YYYY-MM-DD
  startDate?: string;
  endDate?: string;
  status?: EventBookingStatus;
  venueId?: string;
}

