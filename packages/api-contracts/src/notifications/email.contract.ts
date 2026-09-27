// ==============================================================================
// Enterprise HMS — Email Notifications Contracts
// ==============================================================================

export type EmailProviderType = 'SENDGRID' | 'MAILGUN' | 'SES' | 'SMTP' | 'DEMO';

export type EmailStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED' | 'COMPLAINED';

export type EmailTemplateType = 
  | 'RESERVATION_CONFIRMATION'
  | 'RESERVATION_CANCELLATION'
  | 'PRE_ARRIVAL'
  | 'CHECK_IN'
  | 'CHECKOUT'
  | 'PAYMENT_RECEIPT'
  | 'FOLIO_STATEMENT'
  | 'SECURITY_NOTIFICATION';

// ==========================================
// EMAIL PROVIDER CONFIGURATION
// ==========================================

export interface EmailProviderConfigDto {
  id: string;
  propertyId: string;
  provider: EmailProviderType;
  name: string;
  enabled: boolean;
  configuration: Record<string, any>;
  fromEmail: string;
  fromName: string;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmailProviderConfigDto {
  provider: EmailProviderType;
  name: string;
  configuration: Record<string, any>;
  fromEmail: string;
  fromName: string;
}

export interface UpdateEmailProviderConfigDto {
  name?: string;
  configuration?: Record<string, any>;
  fromEmail?: string;
  fromName?: string;
  enabled?: boolean;
}

// ==========================================
// EMAIL TEMPLATES
// ==========================================

export interface EmailTemplateDto {
  id: string;
  propertyId: string;
  type: EmailTemplateType;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmailTemplateDto {
  type: EmailTemplateType;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables?: string[];
}

export interface UpdateEmailTemplateDto {
  name?: string;
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  variables?: string[];
  isActive?: boolean;
}

// ==========================================
// EMAIL QUEUE / DELIVERY
// ==========================================

export interface EmailDto {
  id: string;
  propertyId: string;
  emailProviderConfigId: string;
  templateId?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlContent: string;
  textContent: string;
  status: EmailStatus;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  scheduledAt?: string;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  idempotencyKey: string;
  correlationId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SendEmailDto {
  emailProviderConfigId: string;
  templateId?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  scheduledAt?: string;
  idempotencyKey?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface SendTemplatedEmailDto {
  emailProviderConfigId: string;
  templateType: EmailTemplateType;
  to: string[];
  cc?: string[];
  bcc?: string[];
  variables: Record<string, any>;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  scheduledAt?: string;
  idempotencyKey?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

// ==========================================
// EMAIL DELIVERY WEBHOOK
// ==========================================

export interface EmailWebhookDto {
  id: string;
  propertyId: string;
  emailProviderConfigId: string;
  emailId: string;
  eventType: string; // delivered, bounced, complained, opened, clicked
  payload: Record<string, any>;
  processed: boolean;
  processedAt: string | null;
  correlationId: string | null;
  idempotencyKey: string;
  createdAt: string;
}

// ==========================================
// EMAIL STATS
// ==========================================

export interface EmailStatsDto {
  propertyId: string;
  periodStart: string;
  periodEnd: string;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalBounced: number;
  totalComplained: number;
  deliveryRate: number;
  bounceRate: number;
  complaintRate: number;
  byTemplate: Array<{
    templateType: EmailTemplateType;
    sent: number;
    delivered: number;
    failed: number;
  }>;
}

// ==========================================
// EMAIL PROVIDER ABSTRACTION
// ==========================================

export interface EmailProvider {
  provider: EmailProviderType;
  configure(config: Record<string, any>): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; details?: any }>;
  sendEmail(data: SendEmailDto): Promise<{ externalId: string; status: EmailStatus }>;
  sendTemplatedEmail(data: SendTemplatedEmailDto): Promise<{ externalId: string; status: EmailStatus }>;
  parseWebhook(payload: Record<string, any>, signature?: string): EmailWebhookDto;
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
  generateIdempotencyKey(prefix: string): string;
}

export interface EmailProviderRegistry {
  register(provider: EmailProvider): void;
  get(provider: EmailProviderType): EmailProvider | undefined;
}