import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { RunNightAuditRequest } from '@hms/api-contracts';

export class RunNightAuditDto implements RunNightAuditRequest {
  @ApiPropertyOptional({
    description: 'Whether to proceed despite non-blocking validation warnings',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  overrideWarnings?: boolean;

  @ApiPropertyOptional({
    description: 'Operational justification when overriding non-blocking warnings',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;
}

