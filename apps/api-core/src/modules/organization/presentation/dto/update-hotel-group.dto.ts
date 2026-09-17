import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { OrganizationStatus } from '@hms/api-contracts';

export class UpdateHotelGroupDto {
  @ApiPropertyOptional({
    description: 'Updated name of the hotel group',
    example: 'Global Luxury Resorts International',
  })
  @IsString()
  @IsOptional()
  @Length(2, 128)
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated description of the group portfolio',
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
