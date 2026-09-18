import { IsNotEmpty, IsString, Length } from 'class-validator';
import { CancelReservationDto as ICancelReservationDto } from '@hms/api-contracts';

export class CancelReservationDto implements ICancelReservationDto {
  @IsString()
  @IsNotEmpty({ message: 'Cancellation reason is required' })
  @Length(1, 500)
  reason!: string;
}
