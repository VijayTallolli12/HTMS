import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateRatePlanRequest, RatePlanRoomTypeInput } from '@hms/api-contracts';

export class RatePlanRoomTypeInputDto implements RatePlanRoomTypeInput {
  @IsUUID('all', { message: 'roomTypeId must be a valid UUID' })
  @IsNotEmpty()
  roomTypeId!: string;

  @IsNumber()
  @Min(0)
  baseRateAmount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraAdultRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraChildRate?: number;
}

export class CreateRatePlanDto implements CreateRatePlanRequest {
  @IsString()
  @IsNotEmpty()
  @Length(2, 30)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'code must contain only uppercase alphanumeric characters, underscores, and hyphens.',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  currency!: string;

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

  @IsISO8601(
    { strict: true },
    { message: 'validFrom must be an ISO 8601 date string (YYYY-MM-DD)' },
  )
  @IsNotEmpty()
  validFrom!: string;

  @IsISO8601({ strict: true }, { message: 'validTo must be an ISO 8601 date string (YYYY-MM-DD)' })
  @IsNotEmpty()
  validTo!: string;

  @IsOptional()
  cancellationPolicy?: any;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RatePlanRoomTypeInputDto)
  applicableRoomTypes!: RatePlanRoomTypeInputDto[];
}
