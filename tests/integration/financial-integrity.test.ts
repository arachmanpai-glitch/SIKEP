import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PHASE 11 — spec section 18's mandatory scenario, run against the REAL
 * `ExpenseService.submitExpense` (not a reimplementation of its logic):
 *
 *   "Saldo Rp1.000.000. Dua expense Rp700.000 + Rp700.000. Tidak boleh
 *   menghasilkan saldo negatif apabila allow_negative_balance = false."
 *
 * No real PostgreSQL is available in this environment (see
 * docs/decisions.md — noted since PHASE 2's migration), so genuine
 * concurrent-transaction isolation (Postgres's own Serializable guarantee)
 * cannot be exercised directly. What CAN be verified, and is verified
 * here, is that:
 *   1. `submitExpense` is actually wired through `withSerializableRetry`
 *      end-to-end (a simulated P2034 on the very first DB attempt is
 *      transparently retried and still succeeds) — not just the retry
 *      primitive in isolation (already covered by
 *      tests/unit/lib/serializable-retry.test.ts).
 *   2. Each call re-reads the account balance fresh (mocked as a mutable
 *      value updated by the mocked "post" — the same shape a real re-read
 *      inside a fresh Postgres transaction attempt would see), so a
 *      second expense submitted after the first has posted is correctly
 *      rejected instead of driving the balance negative.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn() },
}));
vi.mock("@/repositories/ApprovalRequestRepository", () => ({
  createPendingApprovalRequest: vi.fn(),
}));
vi.mock("@/repositories/ApprovalSettingsRepository", () => ({
  getOrCreateApprovalSettings: vi.fn(),
}));
vi.mock("@/repositories/ExpenseTransactionRepository", () => ({
  createPendingApprovalExpense: vi.fn(),
  createPostedExpense: vi.fn(),
  findExpenseByIdempotencyKey: vi.fn(),
  findExpenseById: vi.fn(),
  listExpenses: vi.fn(),
  markExpenseVoided: vi.fn(),
}));
vi.mock("@/repositories/FinancialLookupRepository", () => ({
  findActiveExpenseCategory: vi.fn(),
  findActiveFinancialAccount: vi.fn(),
}));
vi.mock("@/repositories/LedgerRepository", () => ({
  createLedgerEntry: vi.fn(),
  findLedgerEntryForExpense: vi.fn(),
}));
vi.mock("@/services/AuditService", () => ({ recordAudit: vi.fn() }));
vi.mock("@/services/FinancialPeriodService", () => ({ assertPeriodOpenForDate: vi.fn() }));
vi.mock("@/services/LedgerService", () => ({
  ensureOpeningBalanceEntry: vi.fn(),
  getAccountBalance: vi.fn(),
}));
vi.mock("@/services/ReversalService", () => ({ reverseLedgerEntry: vi.fn() }));

import { Prisma } from "@prisma/client";

import { FinancialIntegrityError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getOrCreateApprovalSettings } from "@/repositories/ApprovalSettingsRepository";
import {
  createPostedExpense,
  findExpenseByIdempotencyKey,
} from "@/repositories/ExpenseTransactionRepository";
import {
  findActiveExpenseCategory,
  findActiveFinancialAccount,
} from "@/repositories/FinancialLookupRepository";
import { submitExpense } from "@/services/ExpenseService";
import { getAccountBalance } from "@/services/LedgerService";

const SESSION = {
  userId: "bendahara-1",
  schoolId: "school-a",
  roleCode: "BENDAHARA",
  email: "b@sikep.test",
};

const baseInput = {
  financialAccountId: "acc-1",
  categoryId: "cat-1",
  amount: "700000.00",
  transactionDate: new Date("2026-09-19"),
  description: "Pembelian barang",
};

function p2034() {
  return new Prisma.PrismaClientKnownRequestError("write conflict", {
    code: "P2034",
    clientVersion: "7.10.0",
  });
}

describe("integration/financial-integrity — spec section 18", () => {
  let ledgerBalance: Prisma.Decimal;
  let transactionAttempts: number;

  beforeEach(() => {
    ledgerBalance = new Prisma.Decimal("1000000.00");
    transactionAttempts = 0;

    vi.mocked(findActiveExpenseCategory)
      .mockReset()
      .mockResolvedValue({ id: "cat-1", requiresApproval: false } as never);
    vi.mocked(findActiveFinancialAccount)
      .mockReset()
      .mockResolvedValue({ id: "acc-1" } as never);
    vi.mocked(getOrCreateApprovalSettings)
      .mockReset()
      .mockResolvedValue({
        expenseApprovalThreshold: new Prisma.Decimal("1000000.00"),
        allowNegativeBalance: false,
      } as never);
    vi.mocked(findExpenseByIdempotencyKey).mockReset().mockResolvedValue(null);

    // Fresh read every attempt — mirrors what a brand-new Postgres
    // transaction attempt would see after a prior attempt committed.
    vi.mocked(getAccountBalance)
      .mockReset()
      .mockImplementation(async () => ledgerBalance);

    vi.mocked(createPostedExpense)
      .mockReset()
      .mockImplementation(async (_tx, data) => {
        ledgerBalance = ledgerBalance.minus(data.amount);
        return {
          id: `exp-${transactionAttempts}`,
          status: "POSTED",
          amount: new Prisma.Decimal(data.amount),
        } as never;
      });

    // The very first $transaction attempt across this test loses a
    // simulated Postgres serialization race (P2034) — withSerializableRetry
    // must transparently retry it. Every subsequent attempt runs for real.
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) => {
      transactionAttempts++;
      if (transactionAttempts === 1) {
        throw p2034();
      }
      return fn({});
    }) as never);
  });

  it("posts the first Rp700.000 expense (surviving one simulated write-conflict retry)", async () => {
    const result = await submitExpense(SESSION, baseInput, undefined);

    expect(result.expense.status).toBe("POSTED");
    expect(transactionAttempts).toBe(2); // 1 failed (P2034) + 1 successful retry
    expect(ledgerBalance.toString()).toBe("300000");
  });

  it("rejects the second Rp700.000 expense with FinancialIntegrityError — balance never goes negative", async () => {
    await submitExpense(SESSION, baseInput, undefined); // balance: 1,000,000 -> 300,000

    await expect(submitExpense(SESSION, baseInput, undefined)).rejects.toBeInstanceOf(
      FinancialIntegrityError,
    );

    // The rejected attempt must not have touched the ledger at all.
    expect(ledgerBalance.toString()).toBe("300000");
    expect(ledgerBalance.gte(0)).toBe(true);
  });

  it("allows the second expense when allowNegativeBalance is true, and the balance is permitted to go negative", async () => {
    vi.mocked(getOrCreateApprovalSettings).mockResolvedValue({
      expenseApprovalThreshold: new Prisma.Decimal("1000000.00"),
      allowNegativeBalance: true,
    } as never);

    await submitExpense(SESSION, baseInput, undefined); // 1,000,000 -> 300,000
    const second = await submitExpense(SESSION, baseInput, undefined); // 300,000 -> -400,000

    expect(second.expense.status).toBe("POSTED");
    expect(ledgerBalance.toString()).toBe("-400000");
  });
});
