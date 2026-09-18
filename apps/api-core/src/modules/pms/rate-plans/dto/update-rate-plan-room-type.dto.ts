import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';
import { UpdateRatePlanRoomTypeRequest } from '@hms/api-contracts';

export class UpdateRatePlanRoomTypeDto implements UpdateRatePlanRoomTypeRequest {
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseRateAmount?: number;

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
  isActive?: boolean;
}
