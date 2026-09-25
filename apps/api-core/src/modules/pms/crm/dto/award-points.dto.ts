import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, Min, IsOptional, IsEnum } from 'class-validator';
import { LoyaltyTransactionType } from '@hms/api-contracts';

export class AwardPointsDto {
  @ApiProperty({ description: 'Loyalty membership ID' })
  @IsString()
  membershipId!: string;

  @ApiProperty({ description: 'Points to award' })
  @IsInt()
  @Min(1)
  points!: number;

  @ApiPropertyOptional({ description: 'Reference (reservation ID, folio ID, etc.)' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Reference type' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Idempotency key for duplicate prevention' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}