import {
  IsEmail,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CreateReservationDto as ICreateReservationDto,
  GuestInputDto as IGuestInputDto,
} from '@hms/api-contracts';

export class GuestInputDto implements IGuestInputDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  lastName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  identificationType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  identificationNumber?: string;
}

export class CreateReservationDto implements ICreateReservationDto {
  @IsUUID('all', { message: 'roomTypeId must be a valid UUID' })
  @IsNotEmpty()
  roomTypeId!: string;

  @IsUUID('all', { message: 'ratePlanId must be a valid UUID' })
  @IsNotEmpty()
  ratePlanId!: string;

  @IsISO8601({ strict: true }, { message: 'arrivalDate must be a valid ISO 8601 date string' })
  @IsNotEmpty()
  arrivalDate!: string;

  @IsISO8601({ strict: true }, { message: 'departureDate must be a valid ISO 8601 date string' })
  @IsNotEmpty()
  departureDate!: string;

  @IsInt()
  @Min(1)
  adultsCount!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  childrenCount?: number;

  @IsOptional()
  @IsUUID('all', { message: 'guestId must be a valid UUID' })
  guestId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuestInputDto)
  guest?: GuestInputDto;

  @IsOptional()
  @IsString()
  specialRequests?: string;
}
