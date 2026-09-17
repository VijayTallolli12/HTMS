import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class CreatePropertyDto {
  @ApiProperty({
    description: 'Parent Country ID',
    example: '018f6c3a-921b-7a11-89dc-5491b281f9a1',
  })
  @IsUUID()
  @IsNotEmpty()
  countryId: string;

  @ApiProperty({
    description: 'Enterprise-wide unique property code',
    example: 'PROP-TYO-001',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 32)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Code must contain only alphanumeric characters, underscores, or hyphens',
  })
  code: string;

  @ApiProperty({
    description: 'Display name of the hotel/resort',
    example: 'Tokyo Grandeur Palace',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 128)
  name: string;

  @ApiPropertyOptional({
    description: 'Legal registered operating company name',
    example: 'Tokyo Grandeur Hospitality KK',
  })
  @IsString()
  @IsOptional()
  @Length(0, 128)
  legalName?: string;

  @ApiProperty({
    description: 'IANA Time Zone identifier',
    example: 'Asia/Tokyo',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 64)
  timeZone: string;

  @ApiProperty({
    description: 'ISO 4217 3-letter operational currency code',
    example: 'JPY',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'Currency must be a valid 3-letter ISO 4217 currency code (e.g., JPY, USD, EUR)',
  })
  currency: string;

  @ApiPropertyOptional({
    description: 'Street address line 1',
    example: '1-1-1 Marunouchi, Chiyoda-ku',
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
    example: 'Tokyo',
  })
  @IsString()
  @IsOptional()
  @Length(0, 100)
  city?: string;

  @ApiPropertyOptional({
    description: 'State or Province',
    example: 'Tokyo Prefecture',
  })
  @IsString()
  @IsOptional()
  @Length(0, 100)
  stateProvince?: string;

  @ApiPropertyOptional({
    description: 'Postal / ZIP Code',
    example: '100-0005',
  })
  @IsString()
  @IsOptional()
  @Length(0, 32)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Property primary phone number',
    example: '+81 3 5555 0100',
  })
  @IsString()
  @IsOptional()
  @Length(0, 32)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Property primary email address',
    example: 'concierge@tokyograndeur.com',
  })
  @IsEmail()
  @IsOptional()
  email?: string;
}
