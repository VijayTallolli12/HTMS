import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { OrganizationStatus } from '@hms/api-contracts';

export class UpdateCountryDto {
  @ApiPropertyOptional({
    description: 'Updated name of the country',
    example: 'Japan',
  })
  @IsString()
  @IsOptional()
  @Length(2, 128)
  name?: string;

  @ApiPropertyOptional({
    description: 'Lifecycle status',
    enum: OrganizationStatus,
    example: OrganizationStatus.ACTIVE,
  })
  @IsEnum(OrganizationStatus)
  @IsOptional()
  status?: OrganizationStatus;
}
