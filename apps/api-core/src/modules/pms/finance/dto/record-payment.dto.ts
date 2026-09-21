import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaymentMethod } from '@hms/api-contracts';

export class RecordPaymentDto {
  @ApiProperty({
    description: 'Positive payment amount as decimal string',
    example: '250.0000',
  })
  @IsString()
  @IsNotEmpty({ message: 'amount is required' })
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'amount must be a positive decimal string with up to 4 decimal places',
  })
  amount!: string;

  @ApiProperty({
    description: 'Payment settlement tender method',
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  @IsEnum(PaymentMethod, {
    message: `paymentMethod must be one of: ${Object.values(PaymentMethod).join(', ')}`,
  })
  @IsNotEmpty({ message: 'paymentMethod is required' })
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({
    description:
      'External payment reference or transaction identifier (e.g. check number, terminal auth ref)',
    example: 'AUTH-987214',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;
  // NOTE: Currency is intentionally omitted. It is server-derived strictly from Folio.currency.
}
