import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { OrganizationStatus } from '@hms/api-contracts';

export class UpdateRegionDto {
  @ApiPropertyOptional({
    description: 'Updated name of the region',
    example: 'Asia-Pacific & Australasia',
  })
  @IsString()
  @IsOptional()
  @Length(2, 128)
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated description of the region',
  })
  @IsString()
  @IsOptional()
  @Length(0, 512)
  description?: string;

  @ApiPropertyOptional({
    description: 'Lifecycle status',
    enum: OrganizationStatus,
    example: OrganizationStatus.ACTIVE,
  })
  @IsEnum(OrganizationStatus)
  @IsOptional()
  status?: OrganizationStatus;
}
