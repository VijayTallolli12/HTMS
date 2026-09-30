// ==============================================================================
// Enterprise HMS — Payment Gateway Abstraction Contracts
// ==============================================================================

export const PAYMENT_PROVIDER_CODES = [
  'STRIPE', 'ADYEN', 'SQUARE', 'DEMO',
  'AMAZON_PAYMENT_SERVICES', 'TELR', 'NETWORK_INTERNATIONAL', 'TAP', 'PAYTABS', 'CHECKOUT_COM',
  'HYPERPAY', 'MOYASAR', 'GEIDEA', 'BENEFIT', 'PAYPAL', 'RAZORPAY', 'CASHFREE', 'PAYU',
  'GMO_PAYMENT_GATEWAY', 'SB_PAYMENT_SERVICE',
] as const;

export type PaymentProviderType = (typeof PAYMENT_PROVIDER_CODES)[number];
export type PaymentGatewayCapability =
  | 'SALE'
  | 'AUTHORIZE'
  | 'CAPTURE'
  | 'VOID'
  | 'REFUND'
  | 'PARTIAL_REFUND'
  | 'PAYMENT_STATUS'
  | 'TOKENIZATION'
  | 'WEBHOOKS';
export type PaymentGatewayEnvironment = 'SANDBOX' | 'PRODUCTION';
export type PaymentGatewayIntegrationStatus =
  | 'CATALOG_ONLY'
  | 'DEMO_ADAPTER'
  | 'CONFIGURED'
  | 'AUTHENTICATED'
  | 'CONNECTED'
  | 'PRODUCTION_READY'
  | 'PRODUCTION_VERIFIED'
  | 'CONNECTION_FAILED'
  | 'DISABLED';
export type CredentialFieldType = 'text' | 'password' | 'url' | 'number';

export interface CredentialValidationRules {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

export interface CredentialFieldSchema {
  name: string;
  label: string;
  type: CredentialFieldType;
  required: boolean;
  secret: boolean;
  masked: boolean;
  validation?: CredentialValidationRules;
}

export interface PaymentGatewayProviderCatalogItem {
  providerCode: PaymentProviderType;
  displayName: string;
  description: string;
  supportedCountries: string[];
  supportedCurrencies: string[];
  supportedPaymentMethods: string[];
  countryPaymentMethods: Record<string, string[]>;
  credentialSchema: CredentialFieldSchema[];
  capabilities: PaymentGatewayCapability[];
  sandboxSupport: boolean;
  productionSupport: boolean;
  documentationUrl: string;
  adapterStatus: 'CATALOG_ONLY' | 'DEMO_ADAPTER' | 'SANDBOX_READY';
  integrationStatus: PaymentGatewayIntegrationStatus;
}

export interface PaymentGatewayCredentialFieldStatus {
  name: string;
  configured: boolean;
  maskedValue?: string;
}

export interface PaymentGatewayConfigDto {
  id: string;
  propertyId: string;
  providerCode: PaymentProviderType;
  displayName: string;
  environment: PaymentGatewayEnvironment;
  supportedCurrencies: string[];
  enabledPaymentMethods: string[];
  priority: number;
  isPrimary: boolean;
  enabled: boolean;
  integrationStatus: PaymentGatewayIntegrationStatus;
  credentialFields: PaymentGatewayCredentialFieldStatus[];
  createdAt: string;
  updatedAt: string;
}

export interface SavePaymentGatewayConfigDto {
  providerCode: PaymentProviderType;
  environment: PaymentGatewayEnvironment;
  isPrimary?: boolean;
  credentials: Record<string, string>;
  supportedCurrencies: string[];
  enabledPaymentMethods: string[];
  priority?: number;
}

export interface UpdatePaymentGatewayConfigDto {
  environment?: PaymentGatewayEnvironment;
  credentials?: Record<string, string>;
  supportedCurrencies?: string[];
  enabledPaymentMethods?: string[];
  priority?: number;
  isPrimary?: boolean;
  enabled?: boolean;
}

export interface PaymentGatewayConnectionTestDto {
  ok: boolean;
  status: PaymentGatewayIntegrationStatus;
  message: string;
  testedAt: string;
}

export interface PaymentGatewayProvider {
  readonly providerCode: PaymentProviderType;
  readonly capabilities: ReadonlySet<PaymentGatewayCapability>;
  testConnection?(input: {
    environment: PaymentGatewayEnvironment;
    credentials: Readonly<Record<string, string>>;
  }): Promise<PaymentGatewayConnectionTestDto>;
  sale?(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  authorize?(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  capture?(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  void?(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  refund?(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  paymentStatus?(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  tokenize?(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  verifyWebhook?(rawBody: Buffer, signature: string, credentials: Readonly<Record<string, string>>): boolean;
}

export type PaymentGatewayTransactionStatus = 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CANCELLED';

export type PaymentIntentStatus = 'REQUIRES_PAYMENT_METHOD' | 'REQUIRES_CONFIRMATION' | 'REQUIRES_ACTION' | 'PROCESSING' | 'SUCCEEDED' | 'CANCELLED';

// ==========================================
// LEGACY PAYMENT PROVIDER CONFIGURATION
// ==========================================

export interface PaymentProviderConfigDto {
  id: string;
  propertyId: string;
  provider: PaymentProviderType;
  name: string;
  enabled: boolean;
  configuration: Record<string, unknown>;
  supportedCurrencies: string[];
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentProviderConfigDto {
  provider: PaymentProviderType;
  name: string;
  configuration: Record<string, unknown>;
  supportedCurrencies?: string[];
}

export interface UpdatePaymentProviderConfigDto {
  name?: string;
  configuration?: Record<string, unknown>;
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
  folioId?: string;
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
  signature?: string;
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
// LEGACY PROVIDER ADAPTER CONTRACT
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
  parseWebhook(payload: Record<string, any>): PaymentWebhookDto;
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
  generateIdempotencyKey(prefix: string): string;
}

export interface PaymentProviderRegistry {
  register(provider: PaymentProvider): void;
  get(provider: PaymentProviderType): PaymentProvider | undefined;
}
