import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PHASE 11 — route-level security tests (spec section 18 "Security Test").
 * Every prior test in this codebase stopped at the service layer; nothing
 * previously exercised an actual route handler end-to-end. This file
 * imports the real `GET`/`POST` exports and invokes them with a real
 * `NextRequest`, proving the wiring between requireSession/requireRole,
 * requireCsrf, and `handleApiError`'s status-code mapping — not just that
 * each piece works in isolation (already covered elsewhere).
 *
 * `@/lib/rbac` is mocked (session/JWT verification itself is already
 * covered by tests/unit/lib/auth/session.test.ts) so each test can force a
 * specific auth outcome. `@/lib/auth/cookies` is mocked only at the
 * cookie-READ boundary (`getCsrfCookieValue` — the real cookie store needs
 * Next's request-scoped `next/headers`, unavailable outside an actual
 * request) so the REAL `requireCsrf`/`verifyCsrfToken` comparison still
 * runs against the request's own `X-CSRF-Token` header.
 */

vi.mock("@/lib/rbac", () => ({
  requireSession: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/lib/auth/cookies", () => ({
  getCsrfCookieValue: vi.fn(),
}));
vi.mock("@/services/ExpenseService", () => ({
  submitExpense: vi.fn(),
  listExpensesForSchool: vi.fn(),
}));
vi.mock("@/services/UserService", () => ({
  createUserForSchool: vi.fn(),
  listUsersForSchool: vi.fn(),
}));
vi.mock("@/services/FinancialPeriodService", () => ({
  createFinancialPeriod: vi.fn(),
  listFinancialPeriodsForSchool: vi.fn(),
}));
vi.mock("@/services/AuditLogService", () => ({
  listAuditLogsForSchool: vi.fn(),
}));

import { CSRF_HEADER_NAME } from "@/lib/auth/csrf";
import { getCsrfCookieValue } from "@/lib/auth/cookies";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/rbac";

const SESSION = {
  userId: "bendahara-1",
  schoolId: "school-a",
  roleCode: "BENDAHARA",
  email: "b@sikep.test",
};

describe("integration/security — GET routes reject unauthenticated requests", () => {
  it("GET /api/v1/income returns 401 UNAUTHORIZED with no session", async () => {
    vi.mocked(requireSession).mockReset().mockRejectedValue(new UnauthorizedError());
    const { GET } = await import("@/app/api/v1/income/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Anda belum login.", details: undefined },
    });
  });
});

describe("integration/security — role-restricted routes reject the wrong role", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
  });

  it("POST /api/v1/users returns 403 FORBIDDEN for a non-Admin session", async () => {
    vi.mocked(requireRole).mockRejectedValue(new ForbiddenError());
    const { POST } = await import("@/app/api/v1/users/route");

    const request = new NextRequest("http://localhost/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("POST /api/v1/financial-periods returns 403 FORBIDDEN for a non-Bendahara session", async () => {
    vi.mocked(requireRole).mockRejectedValue(new ForbiddenError());
    const { POST } = await import("@/app/api/v1/financial-periods/route");

    const request = new NextRequest("http://localhost/api/v1/financial-periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it("GET /api/v1/audit-logs returns 403 FORBIDDEN for a Bendahara session", async () => {
    vi.mocked(requireRole).mockRejectedValue(new ForbiddenError());
    const { GET } = await import("@/app/api/v1/audit-logs/route");

    const request = new NextRequest("http://localhost/api/v1/audit-logs");
    const response = await GET(request);

    expect(response.status).toBe(403);
  });
});

describe("integration/security — CSRF double-submit check on a mutating route", () => {
  beforeEach(() => {
    vi.mocked(requireRole)
      .mockReset()
      .mockResolvedValue(SESSION as never);
    vi.mocked(getCsrfCookieValue).mockReset();
  });

  it("POST /api/v1/expenses returns 403 when the header doesn't match the cookie", async () => {
    vi.mocked(getCsrfCookieValue).mockResolvedValue("server-side-csrf-value");
    const { POST } = await import("@/app/api/v1/expenses/route");

    const request = new NextRequest("http://localhost/api/v1/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: "attacker-guessed-value" },
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.message).toBe("CSRF token tidak valid.");
  });

  it("POST /api/v1/expenses returns 403 when the CSRF header is missing entirely", async () => {
    vi.mocked(getCsrfCookieValue).mockResolvedValue("server-side-csrf-value");
    const { POST } = await import("@/app/api/v1/expenses/route");

    const request = new NextRequest("http://localhost/api/v1/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it("POST /api/v1/expenses proceeds past the CSRF check when the header matches the cookie", async () => {
    vi.mocked(getCsrfCookieValue).mockResolvedValue("matching-csrf-value");
    const { submitExpense } = await import("@/services/ExpenseService");
    vi.mocked(submitExpense).mockResolvedValue({
      expense: { id: "exp-1", status: "POSTED" },
      replayed: false,
    } as never);
    const { POST } = await import("@/app/api/v1/expenses/route");

    const request = new NextRequest("http://localhost/api/v1/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: "matching-csrf-value" },
      body: JSON.stringify({
        financialAccountId: "11111111-1111-4111-8111-111111111111",
        categoryId: "22222222-2222-4222-8222-222222222222",
        amount: "300000.00",
        transactionDate: "2026-09-19",
        description: "Beli ATK",
      }),
    });
    const response = await POST(request);

    // Reaching the service (not a 403) proves requireCsrf let it through;
    // the actual response shape is ExpenseService's concern, tested elsewhere.
    expect(response.status).not.toBe(403);
    expect(submitExpense).toHaveBeenCalled();
  });
});
