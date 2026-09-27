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
import { ChannelProvider, ChannelSyncType, ChannelSyncStatus, OtaReservationStatus } from '@hms/api-contracts';

// ==========================================
// CHANNEL CONFIGURATION
// ==========================================

export class CreateChannelConfigDto {
  @ApiProperty({ enum: ['BOOKING_COM', 'AIRBNB', 'EXPEDIA', 'DEMO'], description: 'Channel provider' })
  @IsIn(['BOOKING_COM', 'AIRBNB', 'EXPEDIA', 'DEMO'])
  provider!: ChannelProvider;

  @ApiProperty({ example: 'Booking.com Channel', description: 'Human-readable name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Provider-specific configuration (credentials, property mapping, etc.)' })
  @IsObject()
  configuration!: Record<string, any>;

  @ApiPropertyOptional({ description: 'Field mapping for normalization' })
  @IsOptional()
  @IsObject()
  fieldMapping?: Record<string, string>;
}

export class UpdateChannelConfigDto {
  @ApiPropertyOptional({ description: 'Channel name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Provider configuration' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Field mapping' })
  @IsOptional()
  @IsObject()
  fieldMapping?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Enable or disable channel' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

// ==========================================
// SYNC LOGS
// ==========================================

export class ChannelSyncLogQueryDto {
  @ApiPropertyOptional({ description: 'Filter by channel config ID' })
  @IsOptional()
  @IsUUID()
  channelConfigId?: string;

  @ApiPropertyOptional({ enum: ['RESERVATION_INBOUND', 'RESERVATION_OUTBOUND', 'AVAILABILITY', 'RATE', 'RECONCILIATION'], description: 'Sync type filter' })
  @IsOptional()
  @IsIn(['RESERVATION_INBOUND', 'RESERVATION_OUTBOUND', 'AVAILABILITY', 'RATE', 'RECONCILIATION'])
  syncType?: ChannelSyncType;

  @ApiPropertyOptional({ enum: ['SUCCESS', 'FAILED', 'PARTIAL'], description: 'Sync status filter' })
  @IsOptional()
  @IsIn(['SUCCESS', 'FAILED', 'PARTIAL'])
  status?: ChannelSyncStatus;

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

// ==========================================
// RECONCILIATION
// ==========================================

export class GenerateReconciliationDto {
  @ApiProperty({ description: 'Period start (ISO date)' })
  @IsString()
  periodStart!: string;

  @ApiProperty({ description: 'Period end (ISO date)' })
  @IsString()
  periodEnd!: string;
}

// ==========================================
// OTA RESERVATION (for webhook simulation)
// ==========================================

export class SimulateInboundReservationDto {
  @ApiProperty({ enum: ['BOOKING_COM', 'AIRBNB', 'EXPEDIA', 'DEMO'] })
  @IsIn(['BOOKING_COM', 'AIRBNB', 'EXPEDIA', 'DEMO'])
  provider!: ChannelProvider;

  @ApiProperty({ description: 'Raw OTA reservation payload' })
  @IsObject()
  payload!: Record<string, any>;
}