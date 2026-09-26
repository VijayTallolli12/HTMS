// Revenue Management V2 Contracts
// ==============================================================================
// Analytics, Forecasting, Pickup, Market Rates, Pricing Recommendations

// -------------------------------------------------------------
// REVENUE KPIs
// -------------------------------------------------------------
export interface RevenueKpiDto {
  propertyId: string;
  businessDate: string; // 'YYYY-MM-DD'
  occupancyPercent: number;
  adr: string; // Average Daily Rate
  revpar: string; // Revenue Per Available Room
  roomRevenue: string;
  totalAvailableRooms: number;
  totalBookedRooms: number;
  totalOutOfOrderRooms: number;
  totalOutOfServiceRooms: number;
  pickup: string;
  pickupPercent: number;
  forecastOccupancyPercent: number;
  createdAt: string;
}

export interface RevenueKpiRangeQuery {
  propertyId: string;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
}

export interface RevenueKpiRangeResponse {
  propertyId: string;
  dataPoints: RevenueKpiDto[];
  summary: {
    avgOccupancy: number;
    avgAdr: string;
    avgRevpar: string;
    totalRoomRevenue: string;
    totalPickup: string;
  };
}

// -------------------------------------------------------------
// OCCUPANCY TREND
// -------------------------------------------------------------
export interface OccupancyTrendPoint {
  date: string; // 'YYYY-MM-DD'
  occupancyPercent: number;
  availableRooms: number;
  occupiedRooms: number;
  bookedRooms: number;
}

export interface OccupancyTrendResponse {
  propertyId: string;
  startDate: string;
  endDate: string;
  data: OccupancyTrendPoint[];
}

// -------------------------------------------------------------
// ADR TREND
// -------------------------------------------------------------
export interface AdrTrendPoint {
  date: string; // 'YYYY-MM-DD'
  adr: string;
  roomRevenue: string;
  occupiedRooms: number;
}

export interface AdrTrendResponse {
  propertyId: string;
  startDate: string;
  endDate: string;
  data: AdrTrendPoint[];
}

// -------------------------------------------------------------
// REVENUE TREND
// -------------------------------------------------------------
export interface RevenueTrendPoint {
  date: string; // 'YYYY-MM-DD'
  roomRevenue: string;
  occupancyPercent: number;
  adr: string;
}

export interface RevenueTrendResponse {
  propertyId: string;
  startDate: string;
  endDate: string;
  data: RevenueTrendPoint[];
}

// -------------------------------------------------------------
// PICKUP ANALYSIS
// -------------------------------------------------------------
export interface PickupAnalysisPoint {
  date: string; // 'YYYY-MM-DD' (the booking date)
  newBookings: number;
  cancellations: number;
  netPickup: number;
  cumulativeBooked: number;
  bookingPace: number; // bookings per day (7-day rolling)
  occupancyPace: number; // occupancy % per day (7-day rolling)
  bookingWindowDays: number; // average days between booking and arrival
}

export interface PickupAnalysisResponse {
  propertyId: string;
  startDate: string;
  endDate: string;
  data: PickupAnalysisPoint[];
  summary: {
    totalNewBookings: number;
    totalCancellations: number;
    netPickup: number;
    avgBookingPace: number;
    avgBookingWindow: number;
  };
}

export interface PickupByRoomTypePoint {
  roomTypeId: string;
  roomTypeCode: string;
  roomTypeName: string;
  newBookings: number;
  cancellations: number;
  netPickup: number;
  occupancyPercent: number;
}

export interface PickupByRoomTypeResponse {
  propertyId: string;
  startDate: string;
  endDate: string;
  data: PickupByRoomTypePoint[];
}

// -------------------------------------------------------------
// ROOM TYPE PERFORMANCE
// -------------------------------------------------------------
export interface RoomTypePerformanceDto {
  roomTypeId: string;
  roomTypeCode: string;
  roomTypeName: string;
  totalRooms: number;
  occupancyPercent: number;
  adr: string;
  revpar: string;
  roomRevenue: string;
  availableRoomNights: number;
  occupiedRoomNights: number;
  pickup: string;
}

export interface RoomTypePerformanceResponse {
  propertyId: string;
  startDate: string;
  endDate: string;
  data: RoomTypePerformanceDto[];
}

// -------------------------------------------------------------
// REVENUE BY DEPARTMENT
// -------------------------------------------------------------
export interface RevenueByDepartmentDto {
  department: string; // 'ROOMS' | 'FNB' | 'SPA' | 'EVENTS' | 'OTHER'
  revenue: string;
  percentage: number;
}

export interface RevenueByDepartmentResponse {
  propertyId: string;
  businessDate: string;
  data: RevenueByDepartmentDto[];
}

// -------------------------------------------------------------
// FORECAST
// -------------------------------------------------------------
export interface ForecastDemandLevel {
  date: string; // 'YYYY-MM-DD'
  demandLevel: 'HIGH_DEMAND' | 'NORMAL_DEMAND' | 'LOW_DEMAND';
  occupancyForecast: number;
  reason: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ForecastResponse {
  propertyId: string;
  startDate: string;
  endDate: string;
  data: ForecastDemandLevel[];
  methodology: string;
}

// -------------------------------------------------------------
// MARKET RATE PROVIDER (DEMO)
// -------------------------------------------------------------
export interface MarketRateProviderConfigDto {
  id: string;
  propertyId: string;
  providerName: string;
  providerType: 'DEMO_COMPSET' | 'DEMO_OTA' | 'CUSTOM';
  isEnabled: boolean;
  configuration: Record<string, any>; // Demo: compset hotel codes, OTA endpoints
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMarketRateProviderRequest {
  providerName: string;
  providerType: 'DEMO_COMPSET' | 'DEMO_OTA' | 'CUSTOM';
  configuration?: Record<string, any>;
}

export interface UpdateMarketRateProviderRequest {
  providerName?: string;
  isEnabled?: boolean;
  configuration?: Record<string, any>;
}

export interface MarketRateDto {
  date: string; // 'YYYY-MM-DD'
  competitorCode: string;
  competitorName: string;
  roomTypeCode: string;
  rate: string;
  source: 'DEMO_COMPSET' | 'DEMO_OTA' | 'MANUAL';
  capturedAt: string;
}

export interface MarketRateQuery {
  propertyId: string;
  startDate: string;
  endDate: string;
  roomTypeId?: string;
  competitorCode?: string;
}

export interface MarketRateResponse {
  propertyId: string;
  data: MarketRateDto[];
}

// -------------------------------------------------------------
// PRICING RECOMMENDATIONS
// -------------------------------------------------------------
export interface PricingRecommendationDto {
  date: string; // 'YYYY-MM-DD'
  roomTypeId: string;
  roomTypeCode: string;
  roomTypeName: string;
  currentRate: string;
  recommendedRate: string;
  demandLevel: 'HIGH_DEMAND' | 'NORMAL_DEMAND' | 'LOW_DEMAND';
  reason: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  marketRate?: string;
  competitorAvgRate?: string;
}

export interface PricingRecommendationQuery {
  propertyId: string;
  startDate: string;
  endDate: string;
  roomTypeId?: string;
}

export interface PricingRecommendationResponse {
  propertyId: string;
  data: PricingRecommendationDto[];
  generatedAt: string;
  methodology: string;
}

// -------------------------------------------------------------
// COMPETITOR SET (DEMO)
// -------------------------------------------------------------
export interface CompetitorSetDto {
  id: string;
  propertyId: string;
  competitorCode: string;
  competitorName: string;
  isActive: boolean;
  segment: 'LUXURY' | 'UPSCALE' | 'MIDSCALE' | 'ECONOMY';
  distanceKm?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompetitorSetRequest {
  competitorCode: string;
  competitorName: string;
  segment?: 'LUXURY' | 'UPSCALE' | 'MIDSCALE' | 'ECONOMY';
  distanceKm?: number;
}

export interface UpdateCompetitorSetRequest {
  competitorName?: string;
  isActive?: boolean;
  segment?: 'LUXURY' | 'UPSCALE' | 'MIDSCALE' | 'ECONOMY';
  distanceKm?: number;
}

export interface CompetitorSetResponse {
  propertyId: string;
  data: CompetitorSetDto[];
}