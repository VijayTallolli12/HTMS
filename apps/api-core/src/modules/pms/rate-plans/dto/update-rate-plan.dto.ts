import { IsBoolean, IsISO8601, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { UpdateRatePlanRequest } from '@hms/api-contracts';

export class UpdateRatePlanDto implements UpdateRatePlanRequest {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  mealPlanCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  pricingModel?: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @IsBoolean()
  isClosedToArrival?: boolean;

  @IsOptional()
  @IsBoolean()
  isClosedToDeparture?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  minStayDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxStayDays?: number;

  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'validFrom must be an ISO 8601 date string (YYYY-MM-DD)' },
  )
  validFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'validTo must be an ISO 8601 date string (YYYY-MM-DD)' })
  validTo?: string;

  @IsOptional()
  cancellationPolicy?: any;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
