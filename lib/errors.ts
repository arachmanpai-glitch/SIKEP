/**
 * Base class for all expected, handled application errors. Anything thrown
 * that is NOT an AppError is treated as an unexpected bug by the API error
 * handler and returns a generic 500 (see lib/api-response.ts).
 */
export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: string, message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION_ERROR", message, 400, details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Anda belum login.") {
    super("UNAUTHORIZED", message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Anda tidak memiliki akses untuk operasi ini.") {
    super("FORBIDDEN", message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super("NOT_FOUND", `${entity} tidak ditemukan.`, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super("CONFLICT", message, 409, details);
    this.name = "ConflictError";
  }
}

/**
 * Financial-integrity violations: negative balance, posting a voided
 * transaction, double allocation, threshold bypass, etc. Kept distinct from
 * generic ConflictError so callers/tests can assert on it specifically.
 */
export class FinancialIntegrityError extends AppError {
  constructor(message: string, details?: unknown) {
    super("FINANCIAL_INTEGRITY_ERROR", message, 409, details);
    this.name = "FinancialIntegrityError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
