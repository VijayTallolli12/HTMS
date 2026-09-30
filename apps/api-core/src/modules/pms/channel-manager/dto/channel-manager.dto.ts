import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ChannelProvider, ChannelSyncType, ChannelSyncStatus } from '@hms/api-contracts';

// ==========================================
// CHANNEL CONFIGURATION
// ==========================================

export class CreateChannelConfigDto {
  @ApiProperty({ enum: ['DEMO'], description: 'DEMO only; provider connections are simulated' })
  @IsIn(['DEMO'], { message: 'This demo build only supports the DEMO provider' })
  provider!: ChannelProvider;

  @ApiProperty({ example: 'DEMO Channel', description: 'Human-readable name for the simulated DEMO channel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'DEMO-only configuration with local property, room, and rate mappings; no credentials' })
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

  @ApiPropertyOptional({ description: 'DEMO-only configuration for the local simulated adapter; no provider credentials' })
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

  @ApiPropertyOptional({ enum: ['PENDING', 'SUCCESS', 'FAILED', 'PARTIAL'], description: 'Sync status filter' })
  @IsOptional()
  @IsIn(['PENDING', 'SUCCESS', 'FAILED', 'PARTIAL'])
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

export class RetryChannelSyncDto {
  @ApiProperty({ description: 'Failed sync log UUID to retry' })
  @IsUUID()
  syncLogId!: string;
}

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

export class DemoAvailabilityRateSyncDto {
  @ApiProperty({ example: '2026-11-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-11-07' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: 'Demo-only scenario: make the first attempt fail transiently, then verify retry succeeds' })
  @IsOptional()
  @IsBoolean()
  simulateTransientFailure?: boolean;

  @ApiPropertyOptional({ description: 'Demo-only scenario: keep failing through automatic attempts to demonstrate manual retry' })
  @IsOptional()
  @IsBoolean()
  simulatePermanentFailure?: boolean;
}

export class SimulateInboundReservationDto {
  @ApiProperty({ enum: ['DEMO'], description: 'DEMO fixture only; live webhooks are disabled' })
  @IsIn(['DEMO'], { message: 'This endpoint accepts DEMO fixtures only' })
  provider!: ChannelProvider;

  @ApiProperty({ description: 'Raw reservation payload for the explicitly simulated DEMO adapter' })
  @IsObject()
  payload!: Record<string, any>;
}