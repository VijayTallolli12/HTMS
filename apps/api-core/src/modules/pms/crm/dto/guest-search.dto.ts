import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsInt, Min, IsEnum } from 'class-validator';
import { LoyaltyTier } from '@hms/api-contracts';

export class GuestSearchDto {
  @ApiPropertyOptional({ description: 'Search query (name, email, phone)' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ description: 'Filter VIP guests only' })
  @IsOptional()
  @IsBoolean()
  vipOnly?: boolean;

  @ApiPropertyOptional({ enum: LoyaltyTier, description: 'Filter by loyalty tier' })
  @IsOptional()
  @IsEnum(LoyaltyTier)
  tier?: LoyaltyTier;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}