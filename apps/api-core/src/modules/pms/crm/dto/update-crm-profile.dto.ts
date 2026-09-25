import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, IsArray } from 'class-validator';

export class UpdateCrmProfileDto {
  @ApiPropertyOptional({ description: 'VIP flag' })
  @IsOptional()
  @IsBoolean()
  vipFlag?: boolean;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Communication preferences (JSON)' })
  @IsOptional()
  communicationPreferences?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Marketing consent' })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}