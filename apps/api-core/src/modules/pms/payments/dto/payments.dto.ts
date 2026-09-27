import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
  ValidateNested,
} from 'class-validator';
import { PaymentProviderType, PaymentGatewayTransactionStatus, PaymentIntentStatus } from '@hms/api-contracts';

// ==========================================
// PAYMENT PROVIDER CONFIGURATION
// ==========================================

export class CreatePaymentProviderConfigDto {
  @ApiProperty({ enum: ['STRIPE', 'ADYEN', 'SQUARE', 'DEMO'], description: 'Payment provider' })
  @IsIn(['STRIPE', 'ADYEN', 'SQUARE', 'DEMO'])
  provider!: PaymentProviderType;

  @ApiProperty({ example: 'Stripe Payments', description: 'Human-readable name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Provider configuration (API keys, webhook secrets, etc.)' })
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

// ==========================================
// PAYMENT INTENT
// ==========================================

export class CreatePaymentIntentDto {
  @ApiProperty({ description: 'Payment provider configuration ID' })
  @IsUUID()
  paymentProviderConfigId!: string;

  @ApiProperty({ example: 15000, description: 'Amount in minor units (e.g., cents)' })
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

  @ApiPropertyOptional({ enum: ['AUTOMATIC', 'MANUAL'], default: 'AUTOMATIC' })
  @IsOptional()
  @IsIn(['AUTOMATIC', 'MANUAL'])
  captureMethod?: 'AUTOMATIC' | 'MANUAL';

  @ApiPropertyOptional({ enum: ['AUTOMATIC', 'MANUAL'], default: 'AUTOMATIC' })
  @IsOptional()
  @IsIn(['AUTOMATIC', 'MANUAL'])
  confirmationMethod?: 'AUTOMATIC' | 'MANUAL';

  @ApiPropertyOptional({ description: 'Idempotency key for duplicate protection' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
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

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
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

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
}

export class RefundPaymentGatewayTransactionDto {
  @ApiProperty({ description: 'Payment ID' })
  @IsUUID()
  paymentId!: string;

  @ApiPropertyOptional({ description: 'Amount to refund (partial refund), in minor units' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({ description: 'Refund reason' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
}

export class CancelPaymentGatewayTransactionDto {
  @ApiProperty({ description: 'Payment intent ID' })
  @IsUUID()
  paymentIntentId!: string;

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
}

// ==========================================
// WEBHOOK SIMULATION
// ==========================================

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

// ==========================================
// RECONCILIATION
// ==========================================

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