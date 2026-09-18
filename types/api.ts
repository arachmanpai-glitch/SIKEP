/** Shared API/contract types. Mirrors lib/api-response.ts envelopes. */
export interface ApiSuccessBody<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponseBody<T> = ApiSuccessBody<T> | ApiErrorBody;

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Money is always transported as a decimal string ("500000.00"), never a
 * JS number, to avoid floating-point precision loss over JSON.
 */
export type MoneyString = string;
