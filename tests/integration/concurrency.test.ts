import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PHASE 11 — "exactly one winner" concurrency scenarios (spec section 18),
 * run against the REAL service functions with `Promise.all`, rather than
 * asserting each branch in isolation (already done per-service in
 * tests/unit/services/*). The WHERE-clause status guards this simulates
 * (D48) are what actually run against Postgres in production — here they
 * are simulated with a single shared "has this row already been decided"
 * flag per scenario, which is a faithful model of "whichever UPDATE's
 * WHERE clause matches first, wins" since only one of two racing
 * mocked calls can win a synchronous check-then-set.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) },
}));
vi.mock("@/repositories/ApprovalRequestRepository", () => ({
  findApprovalRequestById: vi.fn(),
  listApprovalRequests: vi.fn(),
  markApprovalRequestApproved: vi.fn(),
  markApprovalRequestRejected: vi.fn(),
}));
vi.mock("@/repositories/ExpenseTransactionRepository", () => ({
  findExpenseById: vi.fn(),
  markExpenseRejected: vi.fn(),
}));
vi.mock("@/services/AuditService", () => ({ recordAudit: vi.fn() }));
vi.mock("@/services/ExpenseService", () => ({
  postApprovedExpenseWithinTransaction: vi.fn(),
}));

vi.mock("@/repositories/FinancialPeriodRepository", () => ({
  createPeriod: vi.fn(),
  findClosedPeriodCoveringDate: vi.fn(),
  findOverlappingPeriod: vi.fn(),
  findPeriodById: vi.fn(),
  listPeriods: vi.fn(),
  markPeriodClosed: vi.fn(),
}));
vi.mock("@/repositories/DashboardRepository", () => ({
  listActiveFinancialAccounts: vi.fn(),
}));
vi.mock("@/services/LedgerService", () => ({ getAccountBalanceWithRetry: vi.fn() }));

import { Prisma } from "@prisma/client";

import { ConflictError } from "@/lib/errors";
import {
  findApprovalRequestById,
  markApprovalRequestApproved,
  markApprovalRequestRejected,
} from "@/repositories/ApprovalRequestRepository";
import { listActiveFinancialAccounts } from "@/repositories/DashboardRepository";
import { findExpenseById } from "@/repositories/ExpenseTransactionRepository";
import { findPeriodById, markPeriodClosed } from "@/repositories/FinancialPeriodRepository";
import { approveExpense, rejectExpense } from "@/services/ApprovalService";
import { closeFinancialPeriod } from "@/services/FinancialPeriodService";
import { getAccountBalanceWithRetry } from "@/services/LedgerService";
import { postApprovedExpenseWithinTransaction } from "@/services/ExpenseService";

const YAYASAN_A = {
  userId: "yayasan-a",
  schoolId: "school-a",
  roleCode: "YAYASAN",
  email: "a@sikep.test",
};
const YAYASAN_B = {
  userId: "yayasan-b",
  schoolId: "school-a",
  roleCode: "YAYASAN",
  email: "b@sikep.test",
};
const BENDAHARA = {
  userId: "bendahara-1",
  schoolId: "school-a",
  roleCode: "BENDAHARA",
  email: "bendahara@sikep.test",
};

describe("integration/concurrency — two Yayasan users decide the same approval request", () => {
  let decided: boolean;

  beforeEach(() => {
    decided = false;

    vi.mocked(findApprovalRequestById)
      .mockReset()
      .mockResolvedValue({
        id: "appr-1",
        schoolId: "school-a",
        expenseTransactionId: "exp-1",
        status: "PENDING",
        requestedById: "bendahara-1",
      } as never);
    vi.mocked(findExpenseById)
      .mockReset()
      .mockResolvedValue({
        id: "exp-1",
        schoolId: "school-a",
        status: "PENDING_APPROVAL",
      } as never);
    vi.mocked(postApprovedExpenseWithinTransaction)
      .mockReset()
      .mockResolvedValue({ id: "exp-1", status: "POSTED" } as never);

    vi.mocked(markApprovalRequestApproved)
      .mockReset()
      .mockImplementation(async () => {
        if (decided) throw new Error("P2025 — no row matched status: PENDING");
        decided = true;
        return { id: "appr-1", status: "APPROVED" } as never;
      });
    vi.mocked(markApprovalRequestRejected)
      .mockReset()
      .mockImplementation(async () => {
        if (decided) throw new Error("P2025 — no row matched status: PENDING");
        decided = true;
        return { id: "appr-1", status: "REJECTED" } as never;
      });
  });

  it("lets exactly one of two simultaneous approve calls win", async () => {
    const results = await Promise.allSettled([
      approveExpense(YAYASAN_A, "appr-1"),
      approveExpense(YAYASAN_B, "appr-1"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
  });

  it("lets exactly one of an approve-vs-reject race win, regardless of which one", async () => {
    const results = await Promise.allSettled([
      approveExpense(YAYASAN_A, "appr-1"),
      rejectExpense(YAYASAN_B, "appr-1", "Anggaran tidak sesuai"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
  });
});

describe("integration/concurrency — two Bendahara close the same financial period", () => {
  let closed: boolean;

  beforeEach(() => {
    closed = false;

    vi.mocked(findPeriodById)
      .mockReset()
      .mockResolvedValue({ id: "period-1", schoolId: "school-a", status: "OPEN" } as never);
    vi.mocked(listActiveFinancialAccounts)
      .mockReset()
      .mockResolvedValue([{ id: "acc-1", name: "Kas Utama" } as never]);
    vi.mocked(getAccountBalanceWithRetry)
      .mockReset()
      .mockResolvedValue(new Prisma.Decimal("1000000.00"));
    vi.mocked(markPeriodClosed)
      .mockReset()
      .mockImplementation(async () => {
        if (closed) throw new Error("P2025 — no row matched status: OPEN");
        closed = true;
        return { id: "period-1", status: "CLOSED" } as never;
      });
  });

  it("lets exactly one of two simultaneous close attempts win", async () => {
    const input = { balances: [{ financialAccountId: "acc-1", actualBalance: "1000000.00" }] };

    const results = await Promise.allSettled([
      closeFinancialPeriod(BENDAHARA, "period-1", input),
      closeFinancialPeriod(BENDAHARA, "period-1", input),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
  });
});
