import { NextResponse } from "next/server";

import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Standard API envelopes. See docs/architecture.md section "API Contract" —
 * every /api/v1/* route must respond with one of these two shapes.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function apiSuccess<T>(data: T, message = "Operasi berhasil.", status = 200) {
  const body: ApiSuccess<T> = { success: true, data, message };
  return NextResponse.json(body, { status });
}

export function apiError(code: string, message: string, status: number, details?: unknown) {
  const body: ApiError = { success: false, error: { code, message, details } };
  return NextResponse.json(body, { status });
}

/**
 * Converts any thrown error into a standard ApiError response. Known
 * AppError subclasses map to their declared status code; anything else is
 * logged as unexpected and hidden behind a generic 500 message so internals
 * never leak to the client.
 */
export function handleApiError(error: unknown) {
  if (isAppError(error)) {
    return apiError(error.code, error.message, error.statusCode, error.details);
  }

  logger.error({ err: error }, "Unhandled error in API route");
  return apiError("INTERNAL_ERROR", "Terjadi kesalahan pada server.", 500);
}
