import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
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
import { WhatsAppProviderType, WhatsAppStatus, WhatsAppTemplateType } from '@hms/api-contracts';

// ==========================================
// WHATSAPP PROVIDER CONFIGURATION
// ==========================================

export class CreateWhatsAppProviderConfigDto {
  @ApiProperty({ enum: ['TWILIO', 'GUPSHUP', 'META', 'DEMO'], description: 'WhatsApp provider' })
  @IsIn(['TWILIO', 'GUPSHUP', 'META', 'DEMO'])
  provider!: WhatsAppProviderType;

  @ApiProperty({ example: 'Twilio WhatsApp', description: 'Human-readable name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Provider configuration (API keys, webhook URLs, etc.)' })
  @IsObject()
  configuration!: Record<string, any>;

  @ApiProperty({ example: 'PNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', description: 'Phone Number ID from provider' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  phoneNumberId!: string;

  @ApiProperty({ example: 'BAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', description: 'Business Account ID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  businessAccountId!: string;
}

export class UpdateWhatsAppProviderConfigDto {
  @ApiPropertyOptional({ description: 'Provider name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Provider configuration' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Phone Number ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  phoneNumberId?: string;

  @ApiPropertyOptional({ description: 'Business Account ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessAccountId?: string;

  @ApiPropertyOptional({ description: 'Enable or disable provider' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

// ==========================================
// WHATSAPP TEMPLATES
// ==========================================

export class CreateWhatsAppTemplateDto {
  @ApiProperty({ description: 'WhatsApp provider configuration ID' })
  @IsUUID()
  whatsAppProviderConfigId!: string;

  @ApiProperty({ enum: ['RESERVATION_CONFIRMATION', 'ARRIVAL_REMINDER', 'CHECK_IN', 'CHECKOUT', 'PAYMENT_RECEIPT', 'SERVICE_CONFIRMATION'] })
  @IsIn(['RESERVATION_CONFIRMATION', 'ARRIVAL_REMINDER', 'CHECK_IN', 'CHECKOUT', 'PAYMENT_RECEIPT', 'SERVICE_CONFIRMATION'])
  type!: WhatsAppTemplateType;

  @ApiProperty({ example: 'Reservation Confirmation', description: 'Template name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'en_US', description: 'Template language code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  language!: string;

  @ApiProperty({ enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'] })
  @IsIn(['MARKETING', 'UTILITY', 'AUTHENTICATION'])
  category!: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

  @ApiPropertyOptional({ example: 'Your reservation is confirmed', description: 'Header text' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  headerText?: string;

  @ApiProperty({ example: 'Dear {{1}}, your reservation {{2}} is confirmed for {{3}} to {{4}}.', description: 'Body text with variables' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  bodyText!: string;

  @ApiPropertyOptional({ example: 'Thank you for choosing us!', description: 'Footer text' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  footerText?: string;

  @ApiPropertyOptional({ description: 'Interactive buttons' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  buttons?: Array<{ type: 'QUICK_REPLY' | 'URL'; text: string; url?: string }>;

  @ApiPropertyOptional({ description: 'Available variables', example: ['guestName', 'confirmationNumber', 'arrivalDate', 'departureDate'] })
  @IsOptional()
  @IsString({ each: true })
  variables?: string[];
}

export class UpdateWhatsAppTemplateDto {
  @ApiPropertyOptional({ description: 'Template name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Language code' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({ enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'] })
  @IsOptional()
  @IsIn(['MARKETING', 'UTILITY', 'AUTHENTICATION'])
  category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

  @ApiPropertyOptional({ description: 'Header text' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  headerText?: string;

  @ApiPropertyOptional({ description: 'Body text' })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  bodyText?: string;

  @ApiPropertyOptional({ description: 'Footer text' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  footerText?: string;

  @ApiPropertyOptional({ description: 'Buttons' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  buttons?: Array<{ type: 'QUICK_REPLY' | 'URL'; text: string; url?: string }>;

  @ApiPropertyOptional({ description: 'Available variables' })
  @IsOptional()
  @IsString({ each: true })
  variables?: string[];

  @ApiPropertyOptional({ description: 'Is template active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ==========================================
// SEND WHATSAPP MESSAGE
// ==========================================

export class SendWhatsAppMessageDto {
  @ApiProperty({ description: 'WhatsApp provider configuration ID' })
  @IsUUID()
  whatsAppProviderConfigId!: string;

  @ApiPropertyOptional({ description: 'Template ID (optional for text/image/document messages)' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiProperty({ example: '+15551234567', description: 'Recipient phone number in E.164 format' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  to!: string;

  @ApiProperty({ enum: ['TEMPLATE', 'TEXT', 'IMAGE', 'DOCUMENT'] })
  @IsIn(['TEMPLATE', 'TEXT', 'IMAGE', 'DOCUMENT'])
  type!: 'TEMPLATE' | 'TEXT' | 'IMAGE' | 'DOCUMENT';

  @ApiPropertyOptional({ description: 'Template name (for template messages)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  templateName?: string;

  @ApiPropertyOptional({ example: 'en_US', description: 'Language code' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({ description: 'Template variables', example: { '1': 'John', '2': 'RES-123' } })
  @IsOptional()
  @IsObject()
  templateVariables?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Text content for text messages' })
  @IsOptional()
  @IsString()
  textContent?: string;

  @ApiPropertyOptional({ description: 'Media URL for image/document messages' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mediaUrl?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'NORMAL', 'HIGH'], default: 'NORMAL' })
  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH'])
  priority?: 'LOW' | 'NORMAL' | 'HIGH';

  @ApiPropertyOptional({ description: 'Schedule for later delivery (ISO format)' })
  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'Idempotency key for duplicate protection' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Correlation ID for tracing' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  correlationId?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SendTemplatedWhatsAppDto {
  @ApiProperty({ description: 'WhatsApp provider configuration ID' })
  @IsUUID()
  whatsAppProviderConfigId!: string;

  @ApiProperty({ enum: ['RESERVATION_CONFIRMATION', 'ARRIVAL_REMINDER', 'CHECK_IN', 'CHECKOUT', 'PAYMENT_RECEIPT', 'SERVICE_CONFIRMATION'] })
  @IsIn(['RESERVATION_CONFIRMATION', 'ARRIVAL_REMINDER', 'CHECK_IN', 'CHECKOUT', 'PAYMENT_RECEIPT', 'SERVICE_CONFIRMATION'])
  templateType!: WhatsAppTemplateType;

  @ApiProperty({ example: '+15551234567', description: 'Recipient phone number in E.164 format' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  to!: string;

  @ApiProperty({ description: 'Template variables', example: { '1': 'John Doe', '2': 'RES-12345', '3': '2026-10-01', '4': '2026-10-05' } })
  @IsObject()
  variables!: Record<string, any>;

  @ApiPropertyOptional({ example: 'en_US', description: 'Language code' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'NORMAL', 'HIGH'], default: 'NORMAL' })
  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH'])
  priority?: 'LOW' | 'NORMAL' | 'HIGH';

  @ApiPropertyOptional({ description: 'Schedule for later delivery (ISO format)' })
  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'Idempotency key for duplicate protection' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Correlation ID for tracing' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  correlationId?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}