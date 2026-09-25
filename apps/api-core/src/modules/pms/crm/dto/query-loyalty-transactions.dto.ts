import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { LoyaltyTransactionType } from '@hms/api-contracts';

export class QueryLoyaltyTransactionsDto {
  @ApiPropertyOptional({ description: 'Filter by membership ID' })
  @IsOptional()
  @IsString()
  membershipId?: string;

  @ApiPropertyOptional({ enum: LoyaltyTransactionType, description: 'Filter by transaction type' })
  @IsOptional()
  @IsEnum(LoyaltyTransactionType)
  type?: LoyaltyTransactionType;

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