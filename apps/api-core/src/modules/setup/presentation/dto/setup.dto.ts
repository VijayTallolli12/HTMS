import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class BootstrapAdminDto {
  @ApiProperty({ example: 'admin@yourhotel.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Minimum 12 characters per platform password policy' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'Aiko' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  firstName: string;

  @ApiProperty({ example: 'Tanaka' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  lastName: string;

  @ApiPropertyOptional({ example: '+81 90 1234 5678' })
  @IsString()
  @IsOptional()
  @Length(0, 32)
  phone?: string;

  @ApiPropertyOptional({ enum: ['INDEPENDENT', 'CHAIN'], default: 'INDEPENDENT' })
  @IsIn(['INDEPENDENT', 'CHAIN'])
  @IsOptional()
  organizationType?: 'INDEPENDENT' | 'CHAIN';
}

export class SetupOrganizationDto {
  @ApiProperty({ enum: ['INDEPENDENT', 'CHAIN'] })
  @IsIn(['INDEPENDENT', 'CHAIN'])
  type: 'INDEPENDENT' | 'CHAIN';

  @ApiProperty({ description: 'Hotel group code, unique enterprise-wide', example: 'HG-SAKURA' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 32)
  @Matches(/^[A-Za-z0-9_-]+$/)
  code: string;

  @ApiProperty({ example: 'Sakura Hospitality Group' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 128)
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(0, 512)
  description?: string;

  @ApiPropertyOptional({ description: 'Defaults to DEFAULT', example: 'APAC' })
  @IsString()
  @IsOptional()
  @Length(2, 32)
  @Matches(/^[A-Za-z0-9_-]+$/)
  regionCode?: string;

  @ApiPropertyOptional({ example: 'Asia-Pacific Regional Division' })
  @IsString()
  @IsOptional()
  @Length(2, 128)
  regionName?: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2', example: 'JP' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z]{2}$/, { message: 'countryCode must be a 2-letter ISO 3166-1 alpha-2 code' })
  countryCode: string;

  @ApiPropertyOptional({ example: 'Japan' })
  @IsString()
  @IsOptional()
  @Length(2, 128)
  countryName?: string;
}

export class SetupPropertyDto {
  @ApiProperty({ description: 'Country ID returned by the organization step' })
  @IsString()
  @IsNotEmpty()
  countryId: string;

  @ApiProperty({ example: 'PROP-TYO-001' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 32)
  @Matches(/^[A-Za-z0-9_-]+$/)
  code: string;

  @ApiProperty({ example: 'Sakura Grand Hotel' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 128)
  name: string;

  @ApiProperty({ description: 'IANA time zone', example: 'Asia/Tokyo' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 64)
  timeZone: string;

  @ApiProperty({ description: 'ISO 4217', example: 'JPY' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  @Matches(/^[A-Za-z]{3}$/)
  currency: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(0, 128)
  legalName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(0, 255)
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(0, 255)
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(0, 100)
  city?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(0, 100)
  stateProvince?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(0, 32)
  postalCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(0, 32)
  phone?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;
}
