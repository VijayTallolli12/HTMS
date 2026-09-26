import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SpaRoomType,
  SpaRoomStatus,
  SpaAppointmentStatus,
  SpaSettlementType,
  SpaPaymentMethod,
  SpaServiceAvailability,
  SpaRoomType as SpaRoomTypeEnum,
  SpaRoomStatus as SpaRoomStatusEnum,
  SpaAppointmentStatus as SpaAppointmentStatusEnum,
  SpaSettlementType as SpaSettlementTypeEnum,
  SpaPaymentMethod as SpaPaymentMethodEnum,
  SpaServiceAvailability as SpaServiceAvailabilityEnum,
} from '@hms/api-contracts';

// ==========================================
// SPA SERVICES DTO
// ==========================================
export class CreateSpaServiceDto {
  @ApiProperty({ example: 'SPA-DEEP' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'Deep Tissue Massage' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Intensive muscle therapy' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Category UUID' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ example: 60, default: 60 })
  @IsInt()
  @Min(15)
  @IsOptional()
  durationMinutes?: number;

  @ApiProperty({ example: 15000 })
  @IsNotEmpty()
  price!: string | number;

  @ApiPropertyOptional({ example: 'JPY', default: 'JPY' })
  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ['AVAILABLE', 'UNAVAILABLE'], default: 'AVAILABLE' })
  @IsOptional()
  @IsEnum(SpaServiceAvailability)
  availability?: SpaServiceAvailability;

  @ApiPropertyOptional({ description: 'JSON array of therapist IDs eligible for this service' })
  @IsOptional()
  @IsString()
  eligibleTherapistIds?: string;

  @ApiPropertyOptional({ description: 'JSON array of room types eligible for this service' })
  @IsOptional()
  @IsString()
  eligibleRoomTypes?: string;
}

// ==========================================
// SPA THERAPISTS DTO
// ==========================================
export class CreateSpaTherapistDto {
  @ApiProperty({ example: 'Aoi Takahashi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Deep Tissue & Sports Therapy' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  specialty?: string;

  @ApiPropertyOptional({ example: '+81 3-5555-0301' })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'aoi@tokyograndeur.com' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateSpaTherapistDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  specialty?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ==========================================
// SPA ROOMS DTO
// ==========================================
export class CreateSpaRoomDto {
  @ApiProperty({ example: 'Lotus Suite' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: 'SINGLE', default: 'SINGLE' })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  roomType?: SpaRoomType;

  @ApiPropertyOptional({ example: 'AVAILABLE', default: 'AVAILABLE' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  status?: SpaRoomStatus;
}

export class UpdateSpaRoomDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  roomType?: SpaRoomType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: SpaRoomStatus;
}

// ==========================================
// SPA APPOINTMENTS DTO
// ==========================================
export class CreateSpaAppointmentDto {
  @ApiProperty({ example: 'uuid-service-1' })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({ example: 'uuid-therapist-1' })
  @IsString()
  @IsNotEmpty()
  therapistId!: string;

  @ApiProperty({ example: 'uuid-room-1' })
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @ApiProperty({ example: '2026-09-26T14:00:00.000Z' })
  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @ApiPropertyOptional({ example: 'Daniel Craig' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  guestName?: string;

  @ApiPropertyOptional({ example: '+1 555-0199' })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  guestPhone?: string;

  @ApiPropertyOptional({ example: '104' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  roomNumber?: string;

  @ApiPropertyOptional({ example: 'uuid-res-1' })
  @IsString()
  @IsOptional()
  reservationId?: string;

  @ApiPropertyOptional({ example: 'Prefers firm pressure' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateSpaAppointmentStatusDto {
  @ApiProperty({ example: 'CONFIRMED' })
  @IsString()
  @IsNotEmpty()
  status!: SpaAppointmentStatus;

  @ApiPropertyOptional({ example: 'Guest requested cancellation' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class CompleteSpaAppointmentDto {
  @ApiProperty({ example: 'ROOM_CHARGE' })
  @IsString()
  @IsNotEmpty()
  settlementType!: SpaSettlementType;

  @ApiPropertyOptional({ example: 'ROOM_CHARGE' })
  @IsString()
  @IsOptional()
  paymentMethod?: SpaPaymentMethod;

  @ApiPropertyOptional({ example: '104' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  roomNumber?: string;

  @ApiPropertyOptional({ example: 'uuid-res-1' })
  @IsString()
  @IsOptional()
  reservationId?: string;

  @ApiPropertyOptional({ example: 'uuid-folio-1' })
  @IsString()
  @IsOptional()
  folioId?: string;
}

export class QuerySpaAppointmentsDto {
  @ApiPropertyOptional({ example: '2026-09-26' })
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
  status?: SpaAppointmentStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  therapistId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  roomId?: string;
}

// ==========================================
// SPA SERVICE CATEGORY DTO
// ==========================================
export class CreateSpaServiceCategoryDto {
  @ApiProperty({ example: 'MASSAGE', description: 'Category code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'Massages', description: 'Category name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Massage treatments and therapies' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSpaServiceCategoryDto {
  @ApiPropertyOptional({ example: 'Massages & Therapies' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'All massage treatments and therapies' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ==========================================
// SPA SERVICE ADDON DTO
// ==========================================
export class CreateSpaServiceAddonDto {
  @ApiProperty({ description: 'Service UUID' })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({ example: 'ADDON-HOTSTONE', description: 'Addon unique code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'Hot Stone Enhancement', description: 'Addon name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Premium heated basalt stones' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '3000', description: 'Price adjustment' })
  @IsOptional()
  priceAdjustment?: string | number;

  @ApiPropertyOptional({ example: 'JPY', default: 'JPY' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateSpaServiceAddonDto {
  @ApiPropertyOptional({ example: 'Hot Stone Enhancement Deluxe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '4000' })
  @IsOptional()
  priceAdjustment?: string | number;

  @ApiPropertyOptional({ example: 'JPY' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ==========================================
// SPA SERVICE UPDATES
// ==========================================
export class UpdateSpaServiceDto {
  @ApiPropertyOptional({ example: 'Deep Tissue Massage Deluxe' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 75 })
  @IsInt()
  @Min(15)
  @IsOptional()
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 17000 })
  @IsOptional()
  price?: string | number;

  @ApiPropertyOptional({ example: 'JPY' })
  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ enum: ['AVAILABLE', 'UNAVAILABLE'], default: 'AVAILABLE' })
  @IsOptional()
  @IsEnum(SpaServiceAvailability)
  availability?: SpaServiceAvailability;

  @ApiPropertyOptional({ description: 'JSON array of therapist IDs eligible for this service' })
  @IsOptional()
  @IsString()
  eligibleTherapistIds?: string;

  @ApiPropertyOptional({ description: 'JSON array of room types eligible for this service' })
  @IsOptional()
  @IsString()
  eligibleRoomTypes?: string;

  @ApiPropertyOptional({ description: 'Category UUID' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateSpaServiceAvailabilityDto {
  @ApiProperty({ enum: ['AVAILABLE', 'UNAVAILABLE'], description: 'Availability status' })
  @IsEnum(SpaServiceAvailability)
  availability!: SpaServiceAvailability;
}

export class UpdateSpaServicePriceDto {
  @ApiProperty({ description: 'New base price' })
  price!: string | number;
}

export class QuerySpaServicesDto {
  @ApiPropertyOptional({ description: 'Filter by category UUID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ['AVAILABLE', 'UNAVAILABLE'], description: 'Filter by availability' })
  @IsOptional()
  @IsEnum(SpaServiceAvailability)
  availability?: SpaServiceAvailability;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Search by name or code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number (default 1)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page (default 20)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}