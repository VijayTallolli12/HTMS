import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  QueryReservationsDto as IQueryReservationsDto,
  ReservationStatus,
} from '@hms/api-contracts';

export class QueryReservationsDto implements IQueryReservationsDto {
  @IsOptional()
  @IsISO8601()
  arrivalDate?: string;

  @IsOptional()
  @IsISO8601()
  departureDate?: string;

  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsString()
  confirmationNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
