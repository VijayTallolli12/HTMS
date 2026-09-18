import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { BedConfigurationItem, UpdateRoomTypeRequest } from '@hms/api-contracts';

export class UpdateRoomTypeDto implements UpdateRoomTypeRequest {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  roomClass?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  baseOccupancy?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxOccupancy?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAdults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxChildren?: number;

  @IsOptional()
  @IsArray()
  bedConfiguration?: BedConfigurationItem[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
