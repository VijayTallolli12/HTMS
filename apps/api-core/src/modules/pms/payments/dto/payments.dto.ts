import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PaymentProviderType,
  PaymentGatewayTransactionStatus,
  PaymentIntentStatus,
  PAYMENT_PROVIDER_CODES,
  PaymentGatewayEnvironment,
  SavePaymentGatewayConfigDto,
  UpdatePaymentGatewayConfigDto,
} from '@hms/api-contracts';

export class CreatePaymentProviderConfigDto {
  @ApiProperty({ enum: PAYMENT_PROVIDER_CODES, description: 'Payment provider' })
  @IsIn([...PAYMENT_PROVIDER_CODES])
  provider!: PaymentProviderType;

  @ApiProperty({ example: 'Stripe Payments', description: 'Human-readable name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Provider configuration (legacy endpoint; new administration API encrypts secrets)' })
  @IsObject()
  configuration!: Record<string, any>;

  @ApiPropertyOptional({ description: 'Supported currencies (ISO 4217)', example: ['USD', 'EUR', 'JPY'] })
  @IsOptional()
  @IsString({ each: true })
  supportedCurrencies?: string[];
}

export class UpdatePaymentProviderConfigDto {
  @ApiPropertyOptional({ description: 'Provider name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Provider configuration' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Supported currencies' })
  @IsOptional()
  @IsString({ each: true })
  supportedCurrencies?: string[];

  @ApiPropertyOptional({ description: 'Enable or disable provider' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class SavePaymentGatewayConfigRequest implements SavePaymentGatewayConfigDto {
  @ApiProperty({ enum: PAYMENT_PROVIDER_CODES })
  @IsIn([...PAYMENT_PROVIDER_CODES])
  providerCode!: PaymentProviderType;

  @ApiProperty({ enum: ['SANDBOX', 'PRODUCTION'] })
  @IsIn(['SANDBOX', 'PRODUCTION'])
  environment!: PaymentGatewayEnvironment;

  @ApiProperty({ type: Object })
  @IsObject()
  credentials!: Record<string, string>;

  @ApiProperty({ type: [String] })
  @IsString({ each: true })
  supportedCurrencies!: string[];

  @ApiProperty({ type: [String] })
  @IsString({ each: true })
  enabledPaymentMethods!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdatePaymentGatewayConfigRequest implements UpdatePaymentGatewayConfigDto {
  @ApiPropertyOptional({ enum: ['SANDBOX', 'PRODUCTION'] })
  @IsOptional()
  @IsIn(['SANDBOX', 'PRODUCTION'])
  environment?: PaymentGatewayEnvironment;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  supportedCurrencies?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  enabledPaymentMethods?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class TestGatewayConnectionRequest {
  @ApiProperty()
  @IsUUID()
  gatewayId!: string;
}

export class CreatePaymentIntentDto {
  @ApiProperty({ description: 'Payment provider configuration ID' })
  @IsUUID()
  paymentProviderConfigId!: string;

  @ApiProperty({ example: 15000, description: 'Amount in the currency minor unit scale, per the authoritative ISO currency exponent' })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({ example: 'JPY', description: 'ISO 4217 currency code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  currency!: string;

  @ApiPropertyOptional({ description: 'Payment description' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Folio to settle after provider-authoritative payment confirmation' })
  @IsOptional()
  @IsUUID()
  folioId?: string;

  @ApiPropertyOptional({ enum: ['AUTOMATIC', 'MANUAL'], default: 'AUTOMATIC' })
  @IsOptional()
  @IsIn(['AUTOMATIC', 'MANUAL'])
  captureMethod?: 'AUTOMATIC' | 'MANUAL';

  @ApiPropertyOptional({ enum: ['AUTOMATIC', 'MANUAL'], default: 'AUTOMATIC' })
  @IsOptional()
  @IsIn(['AUTOMATIC', 'MANUAL'])
  confirmationMethod?: 'AUTOMATIC' | 'MANUAL';

  @ApiProperty({ description: 'Required idempotency key for durable payment intent creation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  idempotencyKey!: string;
}

export class AuthorizePaymentGatewayTransactionDto {
  @ApiProperty({ description: 'Payment intent ID' })
  @IsUUID()
  paymentIntentId!: string;

  @ApiPropertyOptional({ description: 'Payment method ID (token from provider)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentMethodId?: string;

  @ApiProperty({ description: 'Required idempotency key for durable payment intent creation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  idempotencyKey!: string;
}

export class CapturePaymentGatewayTransactionDto {
  @ApiProperty({ description: 'Payment ID' })
  @IsUUID()
  paymentId!: string;

  @ApiPropertyOptional({ description: 'Amount to capture (partial capture), in minor units' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @ApiProperty({ description: 'Required idempotency key for this capture operation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  idempotencyKey!: string;
}

export class RefundPaymentGatewayTransactionDto {
  @ApiProperty({ description: 'Gateway transaction ID' })
  @IsUUID()
  paymentId!: string;

  @ApiPropertyOptional({ description: 'Folio Payment ID for the original capture; required if multiple eligible captured payments exist' })
  @IsOptional()
  @IsUUID()
  originalPaymentId?: string;

  @ApiPropertyOptional({ description: 'Amount to refund (partial refund), in minor units' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @ApiProperty({ description: 'Refund reason (required for auditable financial settlement)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason!: string;

  @ApiProperty({ description: 'Required unique idempotency key for this refund operation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  idempotencyKey!: string;
}

export class CancelPaymentGatewayTransactionDto {
  @ApiProperty({ description: 'Payment intent ID' })
  @IsUUID()
  paymentIntentId!: string;

  @ApiProperty({ description: 'Required idempotency key' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  idempotencyKey!: string;
}

export class SimulateWebhookDto {
  @ApiProperty({ description: 'Payment provider configuration ID' })
  @IsUUID()
  paymentProviderConfigId!: string;

  @ApiProperty({ example: 'payment_intent.succeeded', description: 'Webhook event type' })
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @ApiProperty({ description: 'Webhook payload' })
  @IsObject()
  payload!: Record<string, any>;
}

export class GeneratePaymentReconciliationDto {
  @ApiProperty({ description: 'Payment provider configuration ID' })
  @IsUUID()
  paymentProviderConfigId!: string;

  @ApiProperty({ description: 'Period start (ISO date)' })
  @IsString()
  periodStart!: string;

  @ApiProperty({ description: 'Period end (ISO date)' })
  @IsString()
  periodEnd!: string;
}
