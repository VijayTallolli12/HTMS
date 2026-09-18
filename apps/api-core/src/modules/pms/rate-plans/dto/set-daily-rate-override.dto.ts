import {
  IsBoolean,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { SetDailyRateOverrideRequest } from '@hms/api-contracts';

export class SetDailyRateOverrideDto implements SetDailyRateOverrideRequest {
  @IsUUID('all', { message: 'ratePlanId must be a valid UUID' })
  @IsNotEmpty()
  ratePlanId!: string;

  @IsUUID('all', { message: 'roomTypeId must be a valid UUID' })
  @IsNotEmpty()
  roomTypeId!: string;

  @IsISO8601(
    { strict: true },
    { message: 'businessDate must be an ISO 8601 date string (YYYY-MM-DD)' },
  )
  @IsNotEmpty()
  businessDate!: string;

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

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @IsBoolean()
  isClosedToArrival?: boolean | null;

  @IsOptional()
  @IsBoolean()
  isClosedToDeparture?: boolean | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  minStayDays?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxStayDays?: number | null;
}
