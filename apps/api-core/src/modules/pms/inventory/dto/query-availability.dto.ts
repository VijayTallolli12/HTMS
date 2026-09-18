import { IsISO8601, IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { StayQuoteRequest } from '@hms/api-contracts';

export class QueryAvailabilityDto implements StayQuoteRequest {
  @IsISO8601(
    { strict: true },
    { message: 'arrivalDate must be an ISO 8601 date string (YYYY-MM-DD)' },
  )
  @IsNotEmpty()
  arrivalDate!: string;

  @IsISO8601(
    { strict: true },
    { message: 'departureDate must be an ISO 8601 date string (YYYY-MM-DD)' },
  )
  @IsNotEmpty()
  departureDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  adults!: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @IsOptional()
  @IsUUID('all', { message: 'roomTypeId must be a valid UUID' })
  roomTypeId?: string;
}
