import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EventVenueType,
  EventResourceType,
  EventBookingStatus,
  EventBookingType,
  EventSettlementType,
  EventPaymentMethod,
} from '@hms/api-contracts';

// ==========================================
// VENUE DTOs
// ==========================================
export class CreateEventVenueDto {
  @ApiProperty({ example: 'V-BALLROOM' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'Grand Ballroom' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'BALLROOM', default: 'BALLROOM' })
  @IsString()
  @IsOptional()
  venueType?: EventVenueType;

  @ApiProperty({ example: 300 })
  @IsInt()
  @IsPositive()
  capacity!: number;

  @ApiPropertyOptional({ example: 'Main Tower Level 2' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateEventVenueDto {
  @ApiPropertyOptional({ example: 'Grand Ballroom & Annex' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'BALLROOM' })
  @IsString()
  @IsOptional()
  venueType?: EventVenueType;

  @ApiPropertyOptional({ example: 350 })
  @IsInt()
  @IsPositive()
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ example: 'Main Tower Level 2 & 3' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ==========================================
// PACKAGE DTOs
// ==========================================
export class CreateEventPackageDto {
  @ApiProperty({ example: 'PKG-CONF' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'Corporate Conference' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Full-day catering and audio/visual package' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 8000 })
  @IsNotEmpty()
  pricePerGuest!: string | number;

  @ApiPropertyOptional({ example: 'JPY', default: 'JPY' })
  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 20, default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  minGuests?: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateEventPackageDto {
  @ApiPropertyOptional({ example: 'Executive Conference Package' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 8500 })
  @IsOptional()
  pricePerGuest?: string | number;

  @ApiPropertyOptional({ example: 'JPY' })
  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsInt()
  @Min(1)
  @IsOptional()
  minGuests?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ==========================================
// RESOURCE DTOs
// ==========================================
export class CreateEventResourceDto {
  @ApiProperty({ example: 'Tables' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'FURNITURE', default: 'EQUIPMENT' })
  @IsString()
  @IsOptional()
  resourceType?: EventResourceType;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(1)
  totalQuantity!: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateEventResourceDto {
  @ApiPropertyOptional({ example: 'Banquet Round Tables' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'FURNITURE' })
  @IsString()
  @IsOptional()
  resourceType?: EventResourceType;

  @ApiPropertyOptional({ example: 60 })
  @IsInt()
  @Min(1)
  @IsOptional()
  totalQuantity?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AllocateResourceItemDto {
  @ApiProperty({ example: '01a00000-0000-7000-0000-000000000001' })
  @IsString()
  @IsNotEmpty()
  resourceId!: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional({ example: 'Set up around main stage' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class AllocateResourcesDto {
  @ApiProperty({ type: [AllocateResourceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocateResourceItemDto)
  allocations!: AllocateResourceItemDto[];
}

// ==========================================
// BOOKING DTOs
// ==========================================
export class CreateEventBookingDto {
  @ApiProperty({ example: '01a00000-0000-7000-0000-000000000100' })
  @IsString()
  @IsNotEmpty()
  venueId!: string;

  @ApiPropertyOptional({ example: '01a00000-0000-7000-0000-000000000200' })
  @IsString()
  @IsOptional()
  packageId?: string;

  @ApiProperty({ example: 'Daniel Craig' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  hostName!: string;

  @ApiPropertyOptional({ example: 'dcraig@example.com' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  hostEmail?: string;

  @ApiPropertyOptional({ example: '+81-90-5555-0101' })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  hostPhone?: string;

  @ApiProperty({ example: 'Global Tech Summit 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  eventName!: string;

  @ApiPropertyOptional({ example: 'CONFERENCE', default: 'CONFERENCE' })
  @IsString()
  @IsOptional()
  eventType?: EventBookingType;

  @ApiProperty({ example: '2026-10-01T09:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({ example: '2026-10-01T17:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  endTime!: string;

  @ApiProperty({ example: 150 })
  @IsInt()
  @IsPositive()
  expectedGuests!: number;

  @ApiPropertyOptional({ example: 1200000 })
  @IsOptional()
  estimatedAmount?: string | number;

  @ApiPropertyOptional({ example: 'Stage and keynote setup needed' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: '104' })
  @IsString()
  @IsOptional()
  roomNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reservationId?: string;
}

export class UpdateEventBookingStatusDto {
  @ApiProperty({ example: 'CONFIRMED' })
  @IsString()
  @IsNotEmpty()
  status!: EventBookingStatus;

  @ApiPropertyOptional({ example: 'Client request / contract finalized' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class CompleteEventBookingDto {
  @ApiProperty({ example: 'ROOM_CHARGE' })
  @IsString()
  @IsNotEmpty()
  settlementType!: EventSettlementType;

  @ApiPropertyOptional({ example: 'ROOM_CHARGE' })
  @IsString()
  @IsOptional()
  paymentMethod?: EventPaymentMethod;

  @ApiPropertyOptional({ example: '104' })
  @IsString()
  @IsOptional()
  roomNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reservationId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  folioId?: string;
}

export class QueryEventBookingsDto {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ example: 'CONFIRMED' })
  @IsString()
  @IsOptional()
  status?: EventBookingStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  venueId?: string;
}

