export const APP_DEFAULTS = {
  PAGINATION_LIMIT: 25,
  PAGINATION_MAX_LIMIT: 100,
  REQUEST_TIMEOUT_MS: 30000,
  DEFAULT_LOCALE: 'en-US',
  DEFAULT_CURRENCY: 'EUR',
} as const;

export const DOMAINS = [
  'platform',
  'hr',
  'analytics',
  'pms',
  'frontoffice',
  'operations',
  'finance',
  'crm',
  'housekeeping',
  'engineering',
  'guestservices',
  'fnb',
  'spa',
  'sales',
  'revenue',
  'procurement',
  'loyalty',
  'integration',
] as const;

export type DomainName = (typeof DOMAINS)[number];
