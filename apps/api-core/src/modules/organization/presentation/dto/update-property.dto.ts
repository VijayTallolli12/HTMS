import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { OrganizationStatus } from '@hms/api-contracts';

export class UpdatePropertyDto {
  @ApiPropertyOptional({
    description: 'Display name of the hotel/resort',
    example: 'Tokyo Grandeur Palace & Suites',
  })
  @IsString()
  @IsOptional()
  @Length(2, 128)
  name?: string;

  @ApiPropertyOptional({
    description: 'Legal registered operating company name',
  })
  @IsString()
  @IsOptional()
  @Length(0, 128)
  legalName?: string;

  @ApiPropertyOptional({
    description: 'Lifecycle status',
    enum: OrganizationStatus,
    example: OrganizationStatus.ACTIVE,
  })
  @IsEnum(OrganizationStatus)
  @IsOptional()
  status?: OrganizationStatus;

  @ApiPropertyOptional({
    description: 'IANA Time Zone identifier',
    example: 'Asia/Tokyo',
  })
  @IsString()
  @IsOptional()
  @Length(2, 64)
  timeZone?: string;

  @ApiPropertyOptional({
    description: 'ISO 4217 3-letter operational currency code',
    example: 'JPY',
  })
  @IsString()
  @IsOptional()
  @Length(3, 3)
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'Currency must be a valid 3-letter ISO 4217 currency code (e.g., JPY, USD, EUR)',
  })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Street address line 1',
  })
  @IsString()
  @IsOptional()
  @Length(0, 255)
  addressLine1?: string;

  @ApiPropertyOptional({
    description: 'Street address line 2',
  })
  @IsString()
  @IsOptional()
  @Length(0, 255)
  addressLine2?: string;

  @ApiPropertyOptional({
    description: 'City',
  })
  @IsString()
  @IsOptional()
  @Length(0, 100)
  city?: string;

  @ApiPropertyOptional({
    description: 'State or Province',
  })
  @IsString()
  @IsOptional()
  @Length(0, 100)
  stateProvince?: string;

  @ApiPropertyOptional({
    description: 'Postal / ZIP Code',
  })
  @IsString()
  @IsOptional()
  @Length(0, 32)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Property primary phone number',
  })
  @IsString()
  @IsOptional()
  @Length(0, 32)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Property primary email address',
  })
  @IsEmail()
  @IsOptional()
  email?: string;
}
