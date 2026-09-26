import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { RevenueService } from '../services/revenue.service';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import {
  ApiSuccessResponse,
  RevenueKpiRangeResponse,
  OccupancyTrendResponse,
  AdrTrendResponse,
  RevenueTrendResponse,
  PickupAnalysisResponse,
  PickupByRoomTypeResponse,
  RoomTypePerformanceResponse,
  RevenueByDepartmentResponse,
  ForecastResponse,
  MarketRateProviderConfigDto,
  MarketRateResponse,
  PricingRecommendationResponse,
  CompetitorSetDto,
  CompetitorSetResponse,
} from '@hms/api-contracts';
import {
  RequirePermissions,
  RequirePropertyContext,
} from '../../../identity/presentation/decorators/authz.decorators';
import {
  RevenueKpiRangeQueryDto,
  OccupancyTrendQueryDto,
  AdrTrendQueryDto,
  RevenueTrendQueryDto,
  PickupAnalysisQueryDto,
  RoomTypePerformanceQueryDto,
  RevenueByDepartmentQueryDto,
  ForecastQueryDto,
  MarketRateQueryDto,
  PricingRecommendationQueryDto,
  CreateMarketRateProviderDto,
  UpdateMarketRateProviderDto,
  CreateCompetitorSetDto,
  UpdateCompetitorSetDto,
} from '../dto/revenue.dto';

@ApiTags('PMS - Revenue Management')
@Controller('properties/:propertyId/pms/revenue')
@RequirePropertyContext()
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) {}

  // ==========================================
  // REVENUE KPIs
  // ==========================================
  @Get('kpi')
  @RequirePermissions('revenue.kpi.view')
  @ApiOperation({ summary: 'Get revenue KPIs for date range' })
  @ApiResponse({ status: 200, description: 'Revenue KPIs retrieved successfully' })
  async getKpiRange(
    @Param('propertyId') propertyId: string,
    @Query() query: RevenueKpiRangeQueryDto,
  ): Promise<ApiSuccessResponse<RevenueKpiRangeResponse>> {
    const data = await this.revenueService.getKpiRange(propertyId, query.startDate, query.endDate);
    return createApiResponse(data);
  }

  // ==========================================
  // TRENDS
  // ==========================================
  @Get('trends/occupancy')
  @RequirePermissions('revenue.kpi.view')
  @ApiOperation({ summary: 'Get occupancy trend' })
  @ApiResponse({ status: 200, description: 'Occupancy trend retrieved successfully' })
  async getOccupancyTrend(
    @Param('propertyId') propertyId: string,
    @Query() query: OccupancyTrendQueryDto,
  ): Promise<ApiSuccessResponse<OccupancyTrendResponse>> {
    const data = await this.revenueService.getOccupancyTrend(propertyId, query.startDate, query.endDate);
    return createApiResponse(data);
  }

  @Get('trends/adr')
  @RequirePermissions('revenue.kpi.view')
  @ApiOperation({ summary: 'Get ADR trend' })
  @ApiResponse({ status: 200, description: 'ADR trend retrieved successfully' })
  async getAdrTrend(
    @Param('propertyId') propertyId: string,
    @Query() query: AdrTrendQueryDto,
  ): Promise<ApiSuccessResponse<AdrTrendResponse>> {
    const data = await this.revenueService.getAdrTrend(propertyId, query.startDate, query.endDate);
    return createApiResponse(data);
  }

  @Get('trends/revenue')
  @RequirePermissions('revenue.kpi.view')
  @ApiOperation({ summary: 'Get revenue trend' })
  @ApiResponse({ status: 200, description: 'Revenue trend retrieved successfully' })
  async getRevenueTrend(
    @Param('propertyId') propertyId: string,
    @Query() query: RevenueTrendQueryDto,
  ): Promise<ApiSuccessResponse<RevenueTrendResponse>> {
    const data = await this.revenueService.getRevenueTrend(propertyId, query.startDate, query.endDate);
    return createApiResponse(data);
  }

  // ==========================================
  // PICKUP ANALYSIS
  // ==========================================
  @Get('pickup')
  @RequirePermissions('revenue.kpi.view')
  @ApiOperation({ summary: 'Get pickup analysis' })
  @ApiResponse({ status: 200, description: 'Pickup analysis retrieved successfully' })
  async getPickupAnalysis(
    @Param('propertyId') propertyId: string,
    @Query() query: PickupAnalysisQueryDto,
  ): Promise<ApiSuccessResponse<PickupAnalysisResponse>> {
    const data = await this.revenueService.getPickupAnalysis(propertyId, query.startDate, query.endDate);
    return createApiResponse(data);
  }

  @Get('pickup/by-room-type')
  @RequirePermissions('revenue.kpi.view')
  @ApiOperation({ summary: 'Get pickup analysis by room type' })
  @ApiResponse({ status: 200, description: 'Pickup by room type retrieved successfully' })
  async getPickupByRoomType(
    @Param('propertyId') propertyId: string,
    @Query() query: PickupAnalysisQueryDto,
  ): Promise<ApiSuccessResponse<PickupByRoomTypeResponse>> {
    const data = await this.revenueService.getPickupByRoomType(propertyId, query.startDate, query.endDate);
    return createApiResponse(data);
  }

  // ==========================================
  // ROOM TYPE PERFORMANCE
  // ==========================================
  @Get('performance/room-types')
  @RequirePermissions('revenue.kpi.view')
  @ApiOperation({ summary: 'Get room type performance' })
  @ApiResponse({ status: 200, description: 'Room type performance retrieved successfully' })
  async getRoomTypePerformance(
    @Param('propertyId') propertyId: string,
    @Query() query: RoomTypePerformanceQueryDto,
  ): Promise<ApiSuccessResponse<RoomTypePerformanceResponse>> {
    const data = await this.revenueService.getRoomTypePerformance(propertyId, query.startDate, query.endDate);
    return createApiResponse(data);
  }

  // ==========================================
  // REVENUE BY DEPARTMENT
  // ==========================================
  @Get('department')
  @RequirePermissions('revenue.kpi.view')
  @ApiOperation({ summary: 'Get revenue by department for a business date' })
  @ApiResponse({ status: 200, description: 'Revenue by department retrieved successfully' })
  async getRevenueByDepartment(
    @Param('propertyId') propertyId: string,
    @Query() query: RevenueByDepartmentQueryDto,
  ): Promise<ApiSuccessResponse<RevenueByDepartmentResponse>> {
    const data = await this.revenueService.getRevenueByDepartment(propertyId, query.businessDate);
    return createApiResponse(data);
  }

  // ==========================================
  // FORECAST (DETERMINISTIC)
  // ==========================================
  @Get('forecast')
  @RequirePermissions('revenue.forecast.view')
  @ApiOperation({ summary: 'Get deterministic occupancy forecast' })
  @ApiResponse({ status: 200, description: 'Forecast retrieved successfully' })
  async getForecast(
    @Param('propertyId') propertyId: string,
    @Query() query: ForecastQueryDto,
  ): Promise<ApiSuccessResponse<ForecastResponse>> {
    const data = await this.revenueService.getForecast(propertyId, query.startDate, query.endDate);
    return createApiResponse(data);
  }

  // ==========================================
  // MARKET RATE PROVIDERS (DEMO)
  // ==========================================
  @Get('market-rate/providers')
  @RequirePermissions('revenue.market-rate.view')
  @ApiOperation({ summary: 'List market rate providers' })
  @ApiResponse({ status: 200, description: 'Market rate providers retrieved successfully' })
  async getMarketRateProviders(
    @Param('propertyId') propertyId: string,
  ): Promise<ApiSuccessResponse<MarketRateProviderConfigDto[]>> {
    const data = await this.revenueService.getMarketRateProviders(propertyId);
    return createApiResponse(data);
  }

  @Post('market-rate/providers')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('revenue.market-rate.manage')
  @ApiOperation({ summary: 'Create market rate provider' })
  @ApiResponse({ status: 201, description: 'Market rate provider created successfully' })
  async createMarketRateProvider(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateMarketRateProviderDto,
  ): Promise<ApiSuccessResponse<MarketRateProviderConfigDto>> {
    const data = await this.revenueService.createMarketRateProvider(propertyId, dto);
    return createApiResponse(data);
  }

  @Patch('market-rate/providers/:id')
  @RequirePermissions('revenue.market-rate.manage')
  @ApiOperation({ summary: 'Update market rate provider' })
  @ApiResponse({ status: 200, description: 'Market rate provider updated successfully' })
  async updateMarketRateProvider(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMarketRateProviderDto,
  ): Promise<ApiSuccessResponse<MarketRateProviderConfigDto>> {
    const data = await this.revenueService.updateMarketRateProvider(propertyId, id, dto);
    return createApiResponse(data);
  }

  @Get('market-rate/rates')
  @RequirePermissions('revenue.market-rate.view')
  @ApiOperation({ summary: 'Get market rates from providers' })
  @ApiResponse({ status: 200, description: 'Market rates retrieved successfully' })
  async getMarketRates(
    @Param('propertyId') propertyId: string,
    @Query() query: MarketRateQueryDto,
  ): Promise<ApiSuccessResponse<MarketRateResponse>> {
    const data = await this.revenueService.getMarketRates(propertyId, query);
    return createApiResponse(data);
  }

  // ==========================================
  // PRICING RECOMMENDATIONS
  // ==========================================
  @Get('pricing/recommendations')
  @RequirePermissions('revenue.pricing.view')
  @ApiOperation({ summary: 'Get pricing recommendations' })
  @ApiResponse({ status: 200, description: 'Pricing recommendations retrieved successfully' })
  async getPricingRecommendations(
    @Param('propertyId') propertyId: string,
    @Query() query: PricingRecommendationQueryDto,
  ): Promise<ApiSuccessResponse<PricingRecommendationResponse>> {
    const data = await this.revenueService.getPricingRecommendations(propertyId, query);
    return createApiResponse(data);
  }

  // ==========================================
  // COMPETITOR SET
  // ==========================================
  @Get('competitors')
  @RequirePermissions('revenue.market-rate.view')
  @ApiOperation({ summary: 'List competitor set' })
  @ApiResponse({ status: 200, description: 'Competitor set retrieved successfully' })
  async getCompetitorSet(
    @Param('propertyId') propertyId: string,
  ): Promise<ApiSuccessResponse<CompetitorSetResponse>> {
    const data = await this.revenueService.getCompetitorSet(propertyId);
    return createApiResponse(data);
  }

  @Post('competitors')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('revenue.market-rate.manage')
  @ApiOperation({ summary: 'Add competitor to compset' })
  @ApiResponse({ status: 201, description: 'Competitor added successfully' })
  async createCompetitorSet(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateCompetitorSetDto,
  ): Promise<ApiSuccessResponse<CompetitorSetDto>> {
    const data = await this.revenueService.createCompetitorSet(propertyId, dto);
    return createApiResponse(data);
  }

  @Patch('competitors/:id')
  @RequirePermissions('revenue.market-rate.manage')
  @ApiOperation({ summary: 'Update competitor' })
  @ApiResponse({ status: 200, description: 'Competitor updated successfully' })
  async updateCompetitorSet(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCompetitorSetDto,
  ): Promise<ApiSuccessResponse<CompetitorSetDto>> {
    const data = await this.revenueService.updateCompetitorSet(propertyId, id, dto);
    return createApiResponse(data);
  }
}