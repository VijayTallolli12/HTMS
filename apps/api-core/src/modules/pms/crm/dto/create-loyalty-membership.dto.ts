import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { LoyaltyTier } from '@hms/api-contracts';

export class CreateLoyaltyMembershipDto {
  @ApiProperty({ description: 'Guest ID' })
  @IsString()
  guestId!: string;

  @ApiPropertyOptional({ enum: LoyaltyTier, description: 'Initial tier', default: LoyaltyTier.STANDARD })
  @IsOptional()
  @IsEnum(LoyaltyTier)
  tier?: LoyaltyTier = LoyaltyTier.STANDARD;

  @ApiPropertyOptional({ description: 'Initial points balance', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  pointsBalance?: number = 0;
}