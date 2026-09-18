import { IsNotEmpty, IsString, Length } from 'class-validator';
import { CancelMaintenanceBlockRequest as ICancelMaintenanceBlockRequest } from '@hms/api-contracts';

export class CancelMaintenanceBlockDto implements ICancelMaintenanceBlockRequest {
  @IsString()
  @IsNotEmpty({ message: 'Cancellation reason is required' })
  @Length(3, 255, { message: 'reason must be between 3 and 255 characters' })
  reason!: string;
}
