import { ApiProperty } from '@nestjs/swagger';
import { IsISO31661Alpha2, IsNotEmpty, IsString, IsUUID, Length } from 'class-validator';

export class CreateCountryDto {
  @ApiProperty({
    description: 'Parent Region ID',
    example: '018f6c3a-921b-7a11-89dc-5491b281f9a1',
  })
  @IsUUID()
  @IsNotEmpty()
  regionId: string;

  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 country code',
    example: 'JP',
  })
  @IsISO31661Alpha2({
    message: 'Code must be a valid 2-letter ISO 3166-1 alpha-2 country code (e.g., JP, US, GB)',
  })
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'Full display name of the country',
    example: 'Japan',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 128)
  name: string;
}
