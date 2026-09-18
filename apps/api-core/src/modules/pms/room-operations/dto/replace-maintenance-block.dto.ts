import { IsEnum, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import {
  MaintenanceBlockType,
  ReplaceMaintenanceBlockRequest as IReplaceMaintenanceBlockRequest,
} from '@hms/api-contracts';

export class ReplaceMaintenanceBlockDto implements IReplaceMaintenanceBlockRequest {
  @IsEnum(MaintenanceBlockType, {
    message: 'newType must be OUT_OF_ORDER or OUT_OF_SERVICE',
  })
  @IsNotEmpty()
  newType!: MaintenanceBlockType;

  @IsString()
  @IsNotEmpty({ message: 'Replacement reason is required' })
  @Length(3, 255, { message: 'reason must be between 3 and 255 characters' })
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
