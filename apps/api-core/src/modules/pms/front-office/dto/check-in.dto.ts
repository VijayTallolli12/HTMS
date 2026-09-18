import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckInDto {
  @ApiPropertyOptional({ description: 'Allow check-in to a CLEAN room with supervisor override' })
  @IsOptional()
  @IsBoolean()
  allowCleanOverride?: boolean;

  @ApiPropertyOptional({ description: 'Reason for supervisor clean override' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  overrideReason?: string;

  @ApiPropertyOptional({ description: 'Confirmation that guest identification has been verified' })
  @IsOptional()
  @IsBoolean()
  identityVerified?: boolean;

  @ApiPropertyOptional({ description: 'Confirmation that guest registration card has been signed' })
  @IsOptional()
  @IsBoolean()
  registrationCardSigned?: boolean;
}
