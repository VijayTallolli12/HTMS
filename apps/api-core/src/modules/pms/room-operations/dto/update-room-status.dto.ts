import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  HousekeepingStatus,
  UpdateRoomStatusRequest as IUpdateRoomStatusRequest,
} from '@hms/api-contracts';

export class UpdateRoomStatusDto implements IUpdateRoomStatusRequest {
  @IsEnum(HousekeepingStatus, {
    message: 'housekeepingStatus must be one of: DIRTY, CLEANING, CLEAN, INSPECTED, PICKUP',
  })
  @IsNotEmpty()
  housekeepingStatus!: HousekeepingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
