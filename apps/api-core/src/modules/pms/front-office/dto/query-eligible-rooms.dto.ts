import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class QueryEligibleRoomsDto {
  @ApiProperty({ description: 'Reservation ID to evaluate room eligibility for' })
  @IsUUID()
  @IsNotEmpty()
  reservationId: string;

  @ApiPropertyOptional({
    description: 'Include DIRTY/CLEANING rooms for advance pre-assignment',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeDirty?: boolean = true;

  @ApiPropertyOptional({ description: 'Filter by building ID' })
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @ApiPropertyOptional({ description: 'Filter by floor ID' })
  @IsOptional()
  @IsUUID()
  floorId?: string;
}
