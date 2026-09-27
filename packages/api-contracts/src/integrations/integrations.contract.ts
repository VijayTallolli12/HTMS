// ==============================================================================
// Enterprise HMS — Integration Hub Contracts
// ==============================================================================

export type IntegrationType = 'OTA' | 'PAYMENT' | 'EMAIL' | 'WHATSAPP';

export type IntegrationStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'TESTING';

export type SyncType = 'MANUAL' | 'SCHEDULED' | 'WEBHOOK';

export type SyncStatus = 'SUCCESS' | 'FAILED' | 'PARTIAL';

// ==========================================
// INTEGRATIONS
// ==========================================

export interface IntegrationDto {
  id: string;
  propertyId: string;
  provider: string;
  type: IntegrationType;
  name: string;
  status: IntegrationStatus;
  enabled: boolean;
  configuration: Record<string, any>;
  lastSyncAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntegrationDto {
  provider: string;
  type: IntegrationType;
  name: string;
  configuration: Record<string, any>;
}

export interface UpdateIntegrationDto {
  name?: string;
  configuration?: Record<string, any>;
  enabled?: boolean;
}

export interface TestIntegrationConnectionDto {
  configuration: Record<string, any>;
}

// ==========================================
// INTEGRATION SYNC LOGS
// ==========================================

export interface IntegrationSyncLogDto {
  id: string;
  integrationId: string;
  propertyId: string;
  syncType: SyncType;
  status: SyncStatus;
  recordsProcessed: number;
  recordsFailed: number;
  errorMessage: string | null;
  correlationId: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface IntegrationSyncLogQuery {
  integrationId?: string;
  syncType?: SyncType;
  status?: SyncStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ==========================================
// PROVIDER ABSTRACTION
// ==========================================

export interface IntegrationProvider {
  provider: string;
  type: IntegrationType;
  configure(config: Record<string, any>): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; details?: any }>;
  request(method: string, path: string, data?: any, options?: any): Promise<any>;
  response(data: any): any;
  error(error: any): any;
  generateCorrelationId(): string;
  getRetryMetadata(attempt: number): { delay: number; shouldRetry: boolean };
}

export interface IntegrationProviderRegistry {
  register(provider: IntegrationProvider): void;
  get(provider: string, type: IntegrationType): IntegrationProvider | undefined;
  getAllByType(type: IntegrationType): IntegrationProvider[];
}