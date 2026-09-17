import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { OrganizationStatus } from '@hms/api-contracts';

export class UpdateBuildingDto {
  @ApiPropertyOptional({
    description: 'Name of the building or wing',
    example: 'Main Heritage Wing',
  })
  @IsString()
  @IsOptional()
  @Length(2, 128)
  name?: string;

  @ApiPropertyOptional({
    description: 'Description of the building facilities',
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
