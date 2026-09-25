import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateGuestPreferenceDto {
  @ApiProperty({ description: 'Preference value', example: 'low floor' })
  @IsString()
  value!: string;
}