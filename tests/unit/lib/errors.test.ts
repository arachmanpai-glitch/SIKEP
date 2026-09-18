import { describe, expect, it } from "vitest";

import {
  AppError,
  ConflictError,
  FinancialIntegrityError,
  ForbiddenError,
  isAppError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";

describe("lib/errors", () => {
  it("sets code, message, and statusCode on the base AppError", () => {
    const error = new AppError("SOME_CODE", "Pesan error.", 418);
    expect(error.code).toBe("SOME_CODE");
    expect(error.message).toBe("Pesan error.");
    expect(error.statusCode).toBe(418);
    expect(error).toBeInstanceOf(Error);
  });

  it.each([
    [new ValidationError("invalid"), "VALIDATION_ERROR", 400],
    [new UnauthorizedError(), "UNAUTHORIZED", 401],
    [new ForbiddenError(), "FORBIDDEN", 403],
    [new NotFoundError("Santri"), "NOT_FOUND", 404],
    [new ConflictError("conflict"), "CONFLICT", 409],
    [new FinancialIntegrityError("saldo negatif"), "FINANCIAL_INTEGRITY_ERROR", 409],
  ])("%# maps to the correct code and statusCode", (error, code, statusCode) => {
    expect(error.code).toBe(code);
    expect(error.statusCode).toBe(statusCode);
    expect(isAppError(error)).toBe(true);
  });

  it("does not treat a plain Error as an AppError", () => {
    expect(isAppError(new Error("boom"))).toBe(false);
  });

  it("includes entity name in NotFoundError message", () => {
    expect(new NotFoundError("Santri").message).toBe("Santri tidak ditemukan.");
  });
});
