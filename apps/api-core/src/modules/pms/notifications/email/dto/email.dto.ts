import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
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
import { EmailProviderType, EmailStatus, EmailTemplateType } from '@hms/api-contracts';

// ==========================================
// EMAIL PROVIDER CONFIGURATION
// ==========================================

export class CreateEmailProviderConfigDto {
  @ApiProperty({ enum: ['SENDGRID', 'MAILGUN', 'SES', 'SMTP', 'DEMO'], description: 'Email provider' })
  @IsIn(['SENDGRID', 'MAILGUN', 'SES', 'SMTP', 'DEMO'])
  provider!: EmailProviderType;

  @ApiProperty({ example: 'SendGrid Transactional', description: 'Human-readable name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Provider configuration (API keys, SMTP settings, etc.)' })
  @IsObject()
  configuration!: Record<string, any>;

  @ApiProperty({ example: 'noreply@hotel.com', description: 'From email address' })
  @IsEmail()
  fromEmail!: string;

  @ApiProperty({ example: 'Grand Hotel', description: 'From name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fromName!: string;
}

export class UpdateEmailProviderConfigDto {
  @ApiPropertyOptional({ description: 'Provider name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Provider configuration' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'From email address' })
  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @ApiPropertyOptional({ description: 'From name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fromName?: string;

  @ApiPropertyOptional({ description: 'Enable or disable provider' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

// ==========================================
// EMAIL TEMPLATES
// ==========================================

export class CreateEmailTemplateDto {
  @ApiProperty({ enum: ['RESERVATION_CONFIRMATION', 'RESERVATION_CANCELLATION', 'PRE_ARRIVAL', 'CHECK_IN', 'CHECKOUT', 'PAYMENT_RECEIPT', 'FOLIO_STATEMENT', 'SECURITY_NOTIFICATION'] })
  @IsIn(['RESERVATION_CONFIRMATION', 'RESERVATION_CANCELLATION', 'PRE_ARRIVAL', 'CHECK_IN', 'CHECKOUT', 'PAYMENT_RECEIPT', 'FOLIO_STATEMENT', 'SECURITY_NOTIFICATION'])
  type!: EmailTemplateType;

  @ApiProperty({ example: 'Reservation Confirmation - Standard', description: 'Template name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'Your reservation at {{hotelName}} is confirmed!', description: 'Email subject with variables' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @ApiProperty({ description: 'HTML email content with variables like {{guestName}}, {{confirmationNumber}}' })
  @IsString()
  @IsNotEmpty()
  htmlContent!: string;

  @ApiProperty({ description: 'Plain text email content' })
  @IsString()
  @IsNotEmpty()
  textContent!: string;

  @ApiPropertyOptional({ description: 'Available variables', example: ['guestName', 'confirmationNumber', 'hotelName', 'arrivalDate', 'departureDate'] })
  @IsOptional()
  @IsString({ each: true })
  variables?: string[];
}

export class UpdateEmailTemplateDto {
  @ApiPropertyOptional({ description: 'Template name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Email subject' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ description: 'HTML content' })
  @IsOptional()
  @IsString()
  htmlContent?: string;

  @ApiPropertyOptional({ description: 'Text content' })
  @IsOptional()
  @IsString()
  textContent?: string;

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
// SEND EMAIL
// ==========================================

export class SendEmailDto {
  @ApiProperty({ description: 'Email provider configuration ID' })
  @IsUUID()
  emailProviderConfigId!: string;

  @ApiPropertyOptional({ description: 'Template ID (optional if providing content directly)' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiProperty({ type: [String], description: 'Recipient email addresses' })
  @IsArray()
  @IsEmail({}, { each: true })
  to!: string[];

  @ApiPropertyOptional({ type: [String], description: 'CC email addresses' })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @ApiPropertyOptional({ type: [String], description: 'BCC email addresses' })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  bcc?: string[];

  @ApiPropertyOptional({ description: 'Email subject (optional if using template)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ description: 'HTML content (optional if using template)' })
  @IsOptional()
  @IsString()
  htmlContent?: string;

  @ApiPropertyOptional({ description: 'Text content (optional if using template)' })
  @IsOptional()
  @IsString()
  textContent?: string;

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

export class SendTemplatedEmailDto {
  @ApiProperty({ description: 'Email provider configuration ID' })
  @IsUUID()
  emailProviderConfigId!: string;

  @ApiProperty({ enum: ['RESERVATION_CONFIRMATION', 'RESERVATION_CANCELLATION', 'PRE_ARRIVAL', 'CHECK_IN', 'CHECKOUT', 'PAYMENT_RECEIPT', 'FOLIO_STATEMENT', 'SECURITY_NOTIFICATION'] })
  @IsIn(['RESERVATION_CONFIRMATION', 'RESERVATION_CANCELLATION', 'PRE_ARRIVAL', 'CHECK_IN', 'CHECKOUT', 'PAYMENT_RECEIPT', 'FOLIO_STATEMENT', 'SECURITY_NOTIFICATION'])
  templateType!: EmailTemplateType;

  @ApiProperty({ type: [String], description: 'Recipient email addresses' })
  @IsArray()
  @IsEmail({}, { each: true })
  to!: string[];

  @ApiPropertyOptional({ type: [String], description: 'CC email addresses' })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @ApiPropertyOptional({ type: [String], description: 'BCC email addresses' })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  bcc?: string[];

  @ApiProperty({ description: 'Template variables', example: { guestName: 'John Doe', confirmationNumber: 'RES-12345', hotelName: 'Grand Hotel' } })
  @IsObject()
  variables!: Record<string, any>;

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