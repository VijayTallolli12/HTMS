import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateBuildingDto {
  @ApiProperty({
    description: 'Parent Property ID',
    example: '018f6c3a-921b-7a11-89dc-5491b281f9a1',
  })
  @IsUUID()
  @IsNotEmpty()
  propertyId: string;

  @ApiProperty({
    description: 'Building code unique within the Property',
    example: 'MAIN',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 32)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Code must contain only alphanumeric characters, underscores, or hyphens',
  })
  code: string;

  @ApiProperty({
    description: 'Name of the building or wing',
    example: 'Main Wing',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 128)
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the building facilities',
    example: 'Historic guest accommodation and lobby building',
  })
  @IsString()
  @IsOptional()
  @Length(0, 512)
  description?: string;
}
