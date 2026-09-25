import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional } from 'class-validator';

export class AdjustPointsDto {
  @ApiProperty({ description: 'Loyalty membership ID' })
  @IsString()
  membershipId!: string;

  @ApiProperty({ description: 'Points adjustment (positive or negative)' })
  @IsInt()
  points!: number;

  @ApiProperty({ description: 'Reason for adjustment' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ description: 'Idempotency key for duplicate prevention' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}