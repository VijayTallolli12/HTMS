import { Request } from 'express';
import { ApiSuccessResponse } from '@hms/api-contracts';

export function createApiResponse<T>(data: T, req?: Request): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      correlationId: req?.correlationId,
    },
  };
}
