// ==============================================================================
// Enterprise HMS — WhatsApp Notifications Contracts
// ==============================================================================

export type WhatsAppProviderType = 'TWILIO' | 'GUPSHUP' | 'META' | 'DEMO';

export type WhatsAppStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export type WhatsAppTemplateType = 
  | 'RESERVATION_CONFIRMATION'
  | 'ARRIVAL_REMINDER'
  | 'CHECK_IN'
  | 'CHECKOUT'
  | 'PAYMENT_RECEIPT'
  | 'SERVICE_CONFIRMATION';

// ==========================================
// WHATSAPP PROVIDER CONFIGURATION
// ==========================================

export interface WhatsAppProviderConfigDto {
  id: string;
  propertyId: string;
  provider: WhatsAppProviderType;
  name: string;
  enabled: boolean;
  configuration: Record<string, any>;
  phoneNumberId: string;
  businessAccountId: string;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWhatsAppProviderConfigDto {
  provider: WhatsAppProviderType;
  name: string;
  configuration: Record<string, any>;
  phoneNumberId: string;
  businessAccountId: string;
}

export interface UpdateWhatsAppProviderConfigDto {
  name?: string;
  configuration?: Record<string, any>;
  phoneNumberId?: string;
  businessAccountId?: string;
  enabled?: boolean;
}

// ==========================================
// WHATSAPP TEMPLATES
// ==========================================

export interface WhatsAppTemplateDto {
  id: string;
  propertyId: string;
  whatsAppProviderConfigId: string;
  type: WhatsAppTemplateType;
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttons?: Array<{ type: 'QUICK_REPLY' | 'URL'; text: string; url?: string }>;
  variables: string[];
  isActive: boolean;
  externalTemplateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWhatsAppTemplateDto {
  whatsAppProviderConfigId: string;
  type: WhatsAppTemplateType;
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttons?: Array<{ type: 'QUICK_REPLY' | 'URL'; text: string; url?: string }>;
  variables?: string[];
}

export interface UpdateWhatsAppTemplateDto {
  name?: string;
  language?: string;
  category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  headerText?: string;
  bodyText?: string;
  footerText?: string;
  buttons?: Array<{ type: 'QUICK_REPLY' | 'URL'; text: string; url?: string }>;
  variables?: string[];
  isActive?: boolean;
}

// ==========================================
// WHATSAPP MESSAGE QUEUE / DELIVERY
// ==========================================

export interface WhatsAppMessageDto {
  id: string;
  propertyId: string;
  whatsAppProviderConfigId: string;
  templateId?: string;
  to: string; // E.164 format phone number
  type: 'TEMPLATE' | 'TEXT' | 'IMAGE' | 'DOCUMENT';
  templateName?: string;
  language?: string;
  templateVariables?: Record<string, any>;
  textContent?: string;
  mediaUrl?: string;
  status: WhatsAppStatus;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  scheduledAt?: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
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

export interface SendWhatsAppMessageDto {
  whatsAppProviderConfigId: string;
  templateId?: string;
  to: string; // E.164 format
  type: 'TEMPLATE' | 'TEXT' | 'IMAGE' | 'DOCUMENT';
  templateName?: string;
  language?: string;
  templateVariables?: Record<string, any>;
  textContent?: string;
  mediaUrl?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  scheduledAt?: string;
  idempotencyKey?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface SendTemplatedWhatsAppDto {
  whatsAppProviderConfigId: string;
  templateType: WhatsAppTemplateType;
  to: string;
  variables: Record<string, any>;
  language?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  scheduledAt?: string;
  idempotencyKey?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

// ==========================================
// WHATSAPP DELIVERY WEBHOOK
// ==========================================

export interface WhatsAppWebhookDto {
  id: string;
  propertyId: string;
  whatsAppProviderConfigId: string;
  messageId: string;
  eventType: string; // sent, delivered, read, failed
  payload: Record<string, any>;
  processed: boolean;
  processedAt: string | null;
  correlationId: string | null;
  idempotencyKey: string;
  createdAt: string;
}

// ==========================================
// WHATSAPP STATS
// ==========================================

export interface WhatsAppStatsDto {
  propertyId: string;
  periodStart: string;
  periodEnd: string;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  deliveryRate: number;
  readRate: number;
  byTemplate: Array<{
    templateType: WhatsAppTemplateType;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  }>;
}

// ==========================================
// WHATSAPP PROVIDER ABSTRACTION
// ==========================================

export interface WhatsAppProvider {
  provider: WhatsAppProviderType;
  configure(config: Record<string, any>): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; details?: any }>;
  sendMessage(data: SendWhatsAppMessageDto): Promise<{ externalId: string; status: WhatsAppStatus }>;
  sendTemplatedMessage(data: SendTemplatedWhatsAppDto): Promise<{ externalId: string; status: WhatsAppStatus }>;
  parseWebhook(payload: Record<string, any>, signature?: string): WhatsAppWebhookDto;
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
  generateIdempotencyKey(prefix: string): string;
}

export interface WhatsAppProviderRegistry {
  register(provider: WhatsAppProvider): void;
  get(provider: WhatsAppProviderType): WhatsAppProvider | undefined;
}