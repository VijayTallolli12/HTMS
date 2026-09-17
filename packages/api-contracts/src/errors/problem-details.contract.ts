/**
 * RFC 7807 Problem Details representation
 * Standardized error envelope for Enterprise HMS APIs
 */
export interface InvalidParam {
  name: string;
  reason: string;
  value?: unknown;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  invalidParams?: InvalidParam[];
  timestamp: string;
  correlationId?: string;
}
