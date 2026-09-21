import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateFolioDto {
  @ApiProperty({ description: 'ID of the checked-in reservation to associate with this folio' })
  @IsUUID('all', { message: 'reservationId must be a valid UUID' })
  @IsNotEmpty({ message: 'reservationId is required' })
  reservationId!: string;

  @ApiPropertyOptional({ description: 'Optional custom folio number (auto-generated if omitted)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  folioNumber?: string;
}
