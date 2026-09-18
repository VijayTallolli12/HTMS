import { IsBoolean, IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { RoomFeatures, UpdateRoomRequest } from '@hms/api-contracts';

export class UpdateRoomDto implements UpdateRoomRequest {
  @IsOptional()
  @IsString()
  @Length(1, 30)
  roomNumber?: string;

  @IsOptional()
  @IsUUID('all', { message: 'roomTypeId must be a valid UUID' })
  roomTypeId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsObject()
  features?: RoomFeatures;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
