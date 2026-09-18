export interface RatePlanRoomTypeInput {
  roomTypeId: string;
  baseRateAmount: number;
  extraAdultRate?: number;
  extraChildRate?: number;
}

export interface RatePlanRoomTypeDto {
  id: string;
  propertyId: string;
  ratePlanId: string;
  roomTypeId: string;
  baseRateAmount: string; // Decimal serialized as string or number
  extraAdultRate: string;
  extraChildRate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface RatePlanDto {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  description: string | null;
  currency: string;
  mealPlanCode: string;
  pricingModel: string;
  isClosed: boolean;
  isClosedToArrival: boolean;
  isClosedToDeparture: boolean;
  minStayDays: number;
  maxStayDays: number | null;
  validFrom: string; // ISO date 'YYYY-MM-DD'
  validTo: string; // ISO date 'YYYY-MM-DD' (last sellable night)
  cancellationPolicy: any | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  roomTypes?: RatePlanRoomTypeDto[];
}

export interface CreateRatePlanRequest {
  code: string;
  name: string;
  description?: string;
  currency: string;
  mealPlanCode?: string;
  pricingModel?: string;
  isClosed?: boolean;
  isClosedToArrival?: boolean;
  isClosedToDeparture?: boolean;
  minStayDays?: number;
  maxStayDays?: number;
  validFrom: string;
  validTo: string;
  cancellationPolicy?: any;
  applicableRoomTypes: RatePlanRoomTypeInput[];
}

export interface UpdateRatePlanRequest {
  name?: string;
  description?: string;
  mealPlanCode?: string;
  pricingModel?: string;
  isClosed?: boolean;
  isClosedToArrival?: boolean;
  isClosedToDeparture?: boolean;
  minStayDays?: number;
  maxStayDays?: number;
  validFrom?: string;
  validTo?: string;
  cancellationPolicy?: any;
  isActive?: boolean;
}

export interface UpdateRatePlanRoomTypeRequest {
  baseRateAmount?: number;
  extraAdultRate?: number;
  extraChildRate?: number;
  isActive?: boolean;
}

export interface DailyRateDto {
  id: string;
  propertyId: string;
  ratePlanId: string;
  roomTypeId: string;
  businessDate: string; // 'YYYY-MM-DD'
  baseRateAmount: string;
  extraAdultRate: string | null;
  extraChildRate: string | null;
  isClosed: boolean;
  isClosedToArrival: boolean | null;
  isClosedToDeparture: boolean | null;
  minStayDays: number | null;
  maxStayDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SetDailyRateOverrideRequest {
  ratePlanId: string;
  roomTypeId: string;
  businessDate: string;
  baseRateAmount: number;
  extraAdultRate?: number;
  extraChildRate?: number;
  isClosed?: boolean;
  isClosedToArrival?: boolean | null;
  isClosedToDeparture?: boolean | null;
  minStayDays?: number | null;
  maxStayDays?: number | null;
}
