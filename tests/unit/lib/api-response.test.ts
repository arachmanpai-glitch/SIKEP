import { describe, expect, it } from "vitest";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/lib/errors";

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("lib/api-response", () => {
  it("apiSuccess wraps data in the standard success envelope", async () => {
    const response = apiSuccess({ id: "1" }, "Berhasil.");
    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body).toEqual({ success: true, data: { id: "1" }, message: "Berhasil." });
  });

  it("apiError wraps a message in the standard error envelope", async () => {
    const response = apiError("NOT_FOUND", "Santri tidak ditemukan.", 404);
    expect(response.status).toBe(404);
    const body = await readJson(response);
    expect(body).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Santri tidak ditemukan.", details: undefined },
    });
  });

  it("handleApiError maps a known AppError to its declared status code", async () => {
    const response = handleApiError(new NotFoundError("Santri"));
    expect(response.status).toBe(404);
    const body = await readJson(response);
    expect(body.success).toBe(false);
  });

  it("handleApiError maps a ValidationError to 400 with details", async () => {
    const response = handleApiError(new ValidationError("Input tidak valid.", { field: "nis" }));
    expect(response.status).toBe(400);
  });

  it("handleApiError hides unexpected errors behind a generic 500", async () => {
    const response = handleApiError(new Error("stack trace with secrets"));
    expect(response.status).toBe(500);
    const body = await readJson(response);
    expect(body).toMatchObject({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan pada server." },
    });
  });
});
