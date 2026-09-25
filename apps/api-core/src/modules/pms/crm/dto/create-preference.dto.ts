import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { GuestPreferenceCategory } from '@hms/api-contracts';

export class CreateGuestPreferenceDto {
  @ApiProperty({ enum: GuestPreferenceCategory, description: 'Preference category' })
  @IsEnum(GuestPreferenceCategory)
  category!: GuestPreferenceCategory;

  @ApiProperty({ description: 'Preference key', example: 'floor' })
  @IsString()
  preference!: string;

  @ApiProperty({ description: 'Preference value', example: 'high floor' })
  @IsString()
  value!: string;
}