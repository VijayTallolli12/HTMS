import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IntegrationType, IntegrationStatus, SyncType, SyncStatus } from '@hms/api-contracts';

// ==========================================
// INTEGRATIONS
// ==========================================

export class CreateIntegrationDto {
  @ApiProperty({ example: 'booking_com', description: 'Provider identifier' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  provider!: string;

  @ApiProperty({ enum: ['OTA', 'PAYMENT', 'EMAIL', 'WHATSAPP'], description: 'Integration type' })
  @IsIn(['OTA', 'PAYMENT', 'EMAIL', 'WHATSAPP'])
  type!: IntegrationType;

  @ApiProperty({ example: 'Booking.com Channel Manager', description: 'Human-readable name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Provider-specific configuration (secrets should be encrypted)' })
  @IsObject()
  configuration!: Record<string, any>;
}

export class UpdateIntegrationDto {
  @ApiPropertyOptional({ description: 'Integration name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Provider configuration' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Enable or disable integration' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class TestIntegrationConnectionDto {
  @ApiProperty({ description: 'Configuration to test' })
  @IsObject()
  configuration!: Record<string, any>;
}

export class UpdateIntegrationStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'ERROR', 'TESTING'], description: 'Target status' })
  @IsIn(['ACTIVE', 'INACTIVE', 'ERROR', 'TESTING'])
  status!: IntegrationStatus;
}

// ==========================================
// INTEGRATION SYNC LOGS
// ==========================================

export class IntegrationSyncLogQueryDto {
  @ApiPropertyOptional({ description: 'Filter by integration ID' })
  @IsOptional()
  @IsUUID()
  integrationId?: string;

  @ApiPropertyOptional({ enum: ['MANUAL', 'SCHEDULED', 'WEBHOOK'], description: 'Sync type filter' })
  @IsOptional()
  @IsIn(['MANUAL', 'SCHEDULED', 'WEBHOOK'])
  syncType?: SyncType;

  @ApiPropertyOptional({ enum: ['SUCCESS', 'FAILED', 'PARTIAL'], description: 'Sync status filter' })
  @IsOptional()
  @IsIn(['SUCCESS', 'FAILED', 'PARTIAL'])
  status?: SyncStatus;

  @ApiPropertyOptional({ description: 'Start date filter (ISO format)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO format)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, description: 'Page size' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}