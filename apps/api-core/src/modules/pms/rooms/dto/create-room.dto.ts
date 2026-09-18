import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CreateRoomRequest, RoomFeatures } from '@hms/api-contracts';

export class CreateRoomDto implements CreateRoomRequest {
  @IsUUID('all', { message: 'buildingId must be a valid UUID' })
  @IsNotEmpty()
  buildingId!: string;

  @IsUUID('all', { message: 'floorId must be a valid UUID' })
  @IsNotEmpty()
  floorId!: string;

  @IsUUID('all', { message: 'roomTypeId must be a valid UUID' })
  @IsNotEmpty()
  roomTypeId!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 30)
  roomNumber!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsObject()
  features?: RoomFeatures;
}
