import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateHotelGroupDto {
  @ApiProperty({
    description: 'Human-readable unique hotel group code',
    example: 'HG-GLR',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 32)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Code must contain only alphanumeric characters, underscores, or hyphens',
  })
  code: string;

  @ApiProperty({
    description: 'Full name of the hotel group',
    example: 'Global Luxury Resorts & Hotels',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 128)
  name: string;

  @ApiPropertyOptional({
    description: 'Optional description of the group portfolio',
    example: 'Flagship enterprise luxury hospitality portfolio',
  })
  @IsString()
  @IsOptional()
  @Length(0, 512)
  description?: string;
}
