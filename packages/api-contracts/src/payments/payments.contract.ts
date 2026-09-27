// ==============================================================================
// Enterprise HMS — Payment Gateway Abstraction Contracts
// ==============================================================================

export type PaymentProviderType = 'STRIPE' | 'ADYEN' | 'SQUARE' | 'DEMO';

export type PaymentGatewayTransactionStatus = 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CANCELLED';

export type PaymentIntentStatus = 'REQUIRES_PAYMENT_METHOD' | 'REQUIRES_CONFIRMATION' | 'REQUIRES_ACTION' | 'PROCESSING' | 'SUCCEEDED' | 'CANCELLED';

// ==========================================
// PAYMENT PROVIDER CONFIGURATION
// ==========================================

export interface PaymentProviderConfigDto {
  id: string;
  propertyId: string;
  provider: PaymentProviderType;
  name: string;
  enabled: boolean;
  configuration: Record<string, any>;
  supportedCurrencies: string[];
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentProviderConfigDto {
  provider: PaymentProviderType;
  name: string;
  configuration: Record<string, any>;
  supportedCurrencies?: string[];
}

export interface UpdatePaymentProviderConfigDto {
  name?: string;
  configuration?: Record<string, any>;
  supportedCurrencies?: string[];
  enabled?: boolean;
}

// ==========================================
// PAYMENT INTENT
// ==========================================

export interface PaymentIntentDto {
  id: string;
  propertyId: string;
  paymentProviderConfigId: string;
  externalId: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  description?: string;
  metadata: Record<string, any>;
  clientSecret?: string;
  captureMethod: 'AUTOMATIC' | 'MANUAL';
  confirmationMethod: 'AUTOMATIC' | 'MANUAL';
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentIntentDto {
  paymentProviderConfigId: string;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, any>;
  captureMethod?: 'AUTOMATIC' | 'MANUAL';
  confirmationMethod?: 'AUTOMATIC' | 'MANUAL';
  idempotencyKey?: string;
}

// ==========================================
// PAYMENT GATEWAY TRANSACTION
// ==========================================

export interface PaymentGatewayTransactionDto {
  id: string;
  propertyId: string;
  paymentProviderConfigId: string;
  paymentIntentId?: string;
  externalId: string;
  amount: number;
  currency: string;
  status: PaymentGatewayTransactionStatus;
  description?: string;
  metadata: Record<string, any>;
  authorizationCode?: string;
  capturedAt: string | null;
  refundedAmount: number;
  reconciliationStatus: 'PENDING' | 'MATCHED' | 'MISMATCH' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

export interface AuthorizePaymentDto {
  paymentIntentId: string;
  paymentMethodId?: string;
  idempotencyKey?: string;
}

export interface CapturePaymentDto {
  paymentId: string;
  amount?: number;
  idempotencyKey?: string;
}

export interface RefundPaymentDto {
  paymentId: string;
  amount?: number;
  reason?: string;
  idempotencyKey?: string;
}

export interface CancelPaymentDto {
  paymentIntentId: string;
  idempotencyKey?: string;
}

// ==========================================
// WEBHOOK
// ==========================================

export interface PaymentWebhookDto {
  id: string;
  propertyId: string;
  paymentProviderConfigId: string;
  provider: PaymentProviderType;
  eventType: string;
  payload: Record<string, any>;
  processed: boolean;
  processedAt: string | null;
  error: string | null;
  correlationId: string | null;
  idempotencyKey: string;
  createdAt: string;
}

export interface SimulateWebhookDto {
  paymentProviderConfigId: string;
  eventType: string;
  payload: Record<string, any>;
}

// ==========================================
// RECONCILIATION
// ==========================================

export interface PaymentReconciliationDto {
  id: string;
  propertyId: string;
  paymentProviderConfigId: string;
  periodStart: string;
  periodEnd: string;
  totalPayments: number;
  totalRefunds: number;
  matched: number;
  pmsOnly: number;
  providerOnly: number;
  discrepancies: Array<{
    type: 'MISSING_IN_PMS' | 'MISSING_IN_PROVIDER' | 'AMOUNT_MISMATCH' | 'STATUS_MISMATCH' | 'CURRENCY_MISMATCH';
    pmsPaymentId?: string;
    providerPaymentId?: string;
    details: string;
  }>;
  generatedAt: string;
}

export interface GeneratePaymentReconciliationDto {
  paymentProviderConfigId: string;
  periodStart: string;
  periodEnd: string;
}

// ==========================================
// PAYMENT PROVIDER ABSTRACTION
// ==========================================

export interface PaymentProvider {
  provider: PaymentProviderType;
  configure(config: Record<string, any>): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; details?: any }>;
  createPaymentIntent(data: CreatePaymentIntentDto): Promise<{ externalId: string; clientSecret?: string; status: PaymentIntentStatus }>;
  authorizePayment(data: AuthorizePaymentDto): Promise<{ externalId: string; status: PaymentIntentStatus; authorizationCode?: string }>;
  capturePayment(data: CapturePaymentDto): Promise<{ externalId: string; status: PaymentGatewayTransactionStatus; capturedAt: string }>;
  refundPayment(data: RefundPaymentDto): Promise<{ externalId: string; status: PaymentGatewayTransactionStatus; refundedAt: string }>;
  cancelPayment(data: CancelPaymentDto): Promise<{ externalId: string; status: PaymentIntentStatus }>;
  getPayment(externalId: string): Promise<PaymentGatewayTransactionDto | null>;
  parseWebhook(payload: Record<string, any>, signature?: string): PaymentWebhookDto;
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
  generateIdempotencyKey(prefix: string): string;
}

export interface PaymentProviderRegistry {
  register(provider: PaymentProvider): void;
  get(provider: PaymentProviderType): PaymentProvider | undefined;
}