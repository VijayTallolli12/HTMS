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
  description?: string;

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
}

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

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
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

