import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class PostChargeDto {
  @ApiProperty({
    description: 'Transaction accounting code (e.g. ROOM_CHARGE, MINIBAR, RESTAURANT)',
  })
  @IsString()
  @IsNotEmpty({ message: 'transactionCode is required' })
  @MaxLength(50)
  transactionCode!: string;

  @ApiProperty({ description: 'Line item description' })
  @IsString()
  @IsNotEmpty({ message: 'description is required' })
  @MaxLength(255)
  description!: string;

  @ApiProperty({
    description:
      'Total financial effect of the transaction as decimal string (positive for debit, negative for credit)',
    example: '150.0000',
  })
  @IsString()
  @IsNotEmpty({ message: 'amount is required' })
  @Matches(/^-?\d+(\.\d{1,4})?$/, {
    message: 'amount must be a valid decimal string with up to 4 decimal places',
  })
  amount!: string;

  @ApiPropertyOptional({
    description: 'Informational tax component included in amount (subset of amount, NOT additive)',
    example: '15.0000',
    default: '0',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'taxAmount must be a non-negative decimal string with up to 4 decimal places',
  })
  taxAmount?: string;

  @ApiPropertyOptional({
    description: 'Mandatory reason code if amount is negative (credit/rebate)',
    example: 'SERVICE_RECOVERY',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  reasonCode?: string;
}
