import { IsString, IsOptional, IsDateString, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RevenueKpiRangeQueryDto {
  @ApiProperty({ example: '2026-01-01', description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-01-31', description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  endDate!: string;
}

export class OccupancyTrendQueryDto {
  @ApiProperty({ example: '2026-01-01', description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-01-31', description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  endDate!: string;
}

export class AdrTrendQueryDto {
  @ApiProperty({ example: '2026-01-01', description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-01-31', description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  endDate!: string;
}

export class RevenueTrendQueryDto {
  @ApiProperty({ example: '2026-01-01', description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-01-31', description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  endDate!: string;
}

export class PickupAnalysisQueryDto {
  @ApiProperty({ example: '2026-01-01', description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-01-31', description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  endDate!: string;
}

export class RoomTypePerformanceQueryDto {
  @ApiProperty({ example: '2026-01-01', description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-01-31', description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  endDate!: string;
}

export class RevenueByDepartmentQueryDto {
  @ApiProperty({ example: '2026-01-15', description: 'Business date (YYYY-MM-DD)' })
  @IsDateString()
  businessDate!: string;
}

export class ForecastQueryDto {
  @ApiProperty({ example: '2026-01-01', description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-01-31', description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  endDate!: string;
}

export class MarketRateQueryDto {
  @ApiProperty({ example: '2026-01-01', description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-01-31', description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: 'Filter by room type UUID' })
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @ApiPropertyOptional({ description: 'Filter by competitor code' })
  @IsOptional()
  @IsString()
  competitorCode?: string;
}

export class PricingRecommendationQueryDto {
  @ApiProperty({ example: '2026-01-01', description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-01-31', description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: 'Filter by room type UUID' })
  @IsOptional()
  @IsString()
  roomTypeId?: string;
}

export class CreateMarketRateProviderDto {
  @ApiProperty({ example: 'Tokyo Compset', description: 'Provider name' })
  @IsString()
  providerName!: string;

  @ApiProperty({ enum: ['DEMO_COMPSET', 'DEMO_OTA', 'CUSTOM'], example: 'DEMO_COMPSET' })
  @IsEnum(['DEMO_COMPSET', 'DEMO_OTA', 'CUSTOM'])
  providerType!: 'DEMO_COMPSET' | 'DEMO_OTA' | 'CUSTOM';

  @ApiPropertyOptional({ description: 'Provider configuration (demo: compset codes, OTA endpoints)' })
  @IsOptional()
  configuration?: Record<string, any>;
}

export class UpdateMarketRateProviderDto {
  @ApiPropertyOptional({ example: 'Tokyo Compset Updated' })
  @IsOptional()
  @IsString()
  providerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  configuration?: Record<string, any>;
}

export class CreateCompetitorSetDto {
  @ApiProperty({ example: 'COMP-TOK-001', description: 'Competitor code' })
  @IsString()
  competitorCode!: string;

  @ApiProperty({ example: 'Grand Hyatt Tokyo', description: 'Competitor name' })
  @IsString()
  competitorName!: string;

  @ApiPropertyOptional({ enum: ['LUXURY', 'UPSCALE', 'MIDSCALE', 'ECONOMY'], example: 'LUXURY' })
  @IsOptional()
  @IsEnum(['LUXURY', 'UPSCALE', 'MIDSCALE', 'ECONOMY'])
  segment?: 'LUXURY' | 'UPSCALE' | 'MIDSCALE' | 'ECONOMY';

  @ApiPropertyOptional({ example: 2.5, description: 'Distance in km' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;
}

export class UpdateCompetitorSetDto {
  @ApiPropertyOptional({ example: 'Park Hyatt Tokyo' })
  @IsOptional()
  @IsString()
  competitorName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ['LUXURY', 'UPSCALE', 'MIDSCALE', 'ECONOMY'] })
  @IsOptional()
  @IsEnum(['LUXURY', 'UPSCALE', 'MIDSCALE', 'ECONOMY'])
  segment?: 'LUXURY' | 'UPSCALE' | 'MIDSCALE' | 'ECONOMY';

  @ApiPropertyOptional({ example: 3.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;
}