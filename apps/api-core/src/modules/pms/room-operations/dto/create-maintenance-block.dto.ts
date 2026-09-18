import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import {
  MaintenanceBlockType,
  CreateMaintenanceBlockRequest as ICreateMaintenanceBlockRequest,
} from '@hms/api-contracts';

export class CreateMaintenanceBlockDto implements ICreateMaintenanceBlockRequest {
  @IsUUID('all', { message: 'roomId must be a valid UUID' })
  @IsNotEmpty()
  roomId!: string;

  @IsEnum(MaintenanceBlockType, {
    message: 'type must be OUT_OF_ORDER or OUT_OF_SERVICE',
  })
  @IsNotEmpty()
  type!: MaintenanceBlockType;

  @IsISO8601(
    { strict: true },
    { message: 'startDate must be a valid ISO 8601 date string (YYYY-MM-DD)' },
  )
  @IsNotEmpty()
  startDate!: string;

  @IsISO8601(
    { strict: true },
    { message: 'endDate must be a valid ISO 8601 date string (YYYY-MM-DD)' },
  )
  @IsNotEmpty()
  endDate!: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 255, { message: 'reason must be between 3 and 255 characters' })
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
