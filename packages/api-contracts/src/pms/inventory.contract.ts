export interface DailyInventoryDto {
  id: string;
  propertyId: string;
  roomTypeId: string;
  businessDate: string; // 'YYYY-MM-DD'
  totalRooms: number;
  outOfOrderCount: number;
  outOfServiceCount: number;
  blockedCount: number;
  bookedCount: number;
  overbookingLimit: number;
  ats: number;
  physicalAvailable: number;
  maxSellable: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AtsCalculationResult {
  ats: number;
  physicalAvailable: number;
  maxSellable: number;
}

export interface StayQuoteNightRate {
  date: string; // 'YYYY-MM-DD'
  amount: string;
}

export interface StayQuoteOption {
  ratePlanId: string;
  ratePlanCode: string;
  ratePlanName: string;
  roomTypeId: string;
  roomTypeCode: string;
  roomTypeName: string;
  totalAmount: string;
  currency: string;
  nightlyRates: StayQuoteNightRate[];
  isAvailable: boolean;
  rejectionReason?: string;
}

export interface StayQuoteRequest {
  arrivalDate: string; // 'YYYY-MM-DD'
  departureDate: string; // 'YYYY-MM-DD'
  adults: number;
  children?: number;
  roomTypeId?: string;
}

export interface StayQuoteResponse {
  propertyId: string;
  arrivalDate: string;
  departureDate: string;
  lengthOfStay: number;
  options: StayQuoteOption[];
}

export interface InventoryCalendarQuery {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  roomTypeId?: string;
}
