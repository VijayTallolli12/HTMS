import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateRegionDto {
  @ApiProperty({
    description: 'Parent Hotel Group ID',
    example: '018f6c3a-921b-7a11-89dc-5491b281f9a1',
  })
  @IsUUID()
  @IsNotEmpty()
  hotelGroupId: string;

  @ApiProperty({
    description: 'Region code unique within the Hotel Group',
    example: 'APAC',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 32)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Code must contain only alphanumeric characters, underscores, or hyphens',
  })
  code: string;

  @ApiProperty({
    description: 'Full name of the region',
    example: 'Asia-Pacific Regional Division',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 128)
  name: string;

  @ApiPropertyOptional({
    description: 'Optional description of the region',
    example: 'Regional cluster operations',
  })
  @IsString()
  @IsOptional()
  @Length(0, 512)
  description?: string;
}
