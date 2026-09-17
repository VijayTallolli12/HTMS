import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Length } from 'class-validator';
import { OrganizationStatus } from '@hms/api-contracts';

export class UpdateFloorDto {
  @ApiPropertyOptional({
    description: 'Display label or name of the floor',
    example: 'Executive Level 1',
  })
  @IsString()
  @IsOptional()
  @Length(1, 128)
  name?: string;

  @ApiPropertyOptional({
    description: 'Floor number / order sequence',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  floorNumber?: number;

  @ApiPropertyOptional({
    description: 'Lifecycle status',
    enum: OrganizationStatus,
    example: OrganizationStatus.ACTIVE,
  })
  @IsEnum(OrganizationStatus)
  @IsOptional()
  status?: OrganizationStatus;
}
