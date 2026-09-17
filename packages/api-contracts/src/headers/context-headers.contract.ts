export const HTTP_HEADERS = {
  CORRELATION_ID: 'x-correlation-id',
  TENANT_ID: 'x-tenant-id',
  PROPERTY_ID: 'x-property-id',
  IDEMPOTENCY_KEY: 'idempotency-key',
} as const;

export interface ContextHeaders {
  correlationId?: string;
  tenantId?: string;
  propertyId?: string;
  idempotencyKey?: string;
}
