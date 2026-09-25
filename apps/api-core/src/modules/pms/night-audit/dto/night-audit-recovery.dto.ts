import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NightAuditRecoveryRequest } from '@hms/api-contracts';

export class NightAuditRecoveryDto implements NightAuditRecoveryRequest {
  @ApiProperty({
    description: 'Operational justification for recovering or unlocking stuck night audit',
    example: 'Manual unlock following worker restart',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty({ message: 'reason is required' })
  @MaxLength(500)
  reason!: string;
}

