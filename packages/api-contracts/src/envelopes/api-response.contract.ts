export interface ApiMeta {
  timestamp: string;
  correlationId?: string;
  pagination?: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}
