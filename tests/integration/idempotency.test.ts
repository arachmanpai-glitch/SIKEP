import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PHASE 11 — Idempotency-Key replay (spec section 17/D34), run against the
 * REAL `IncomeService.recordIncome` with a small in-memory fake "table"
 * shared across calls — not just the `withIdempotency` primitive in
 * isolation (tests/unit/lib/idempotency.test.ts already covers that).
 * Models the two situations a client retry can hit in production:
 *   1. Sequential retry — the first request's row already committed by the
 *      time the retry arrives; `findExisting` finds it directly.
 *   2. Racing retry — both requests' `findExisting` miss (neither has
 *      committed yet), the loser's INSERT hits the `idempotency_key`
 *      unique constraint (P2002), and it re-fetches the winner's row
 *      instead of erroring or double-posting.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) },
}));
vi.mock("@/repositories/FinancialLookupRepository", () => ({
  findActiveFinancialAccount: vi.fn(),
  findActiveFundSource: vi.fn(),
  findActiveIncomeCategory: vi.fn(),
}));
vi.mock("@/repositories/IncomeTransactionRepository", () => ({
  createPostedIncome: vi.fn(),
  findIncomeByIdempotencyKey: vi.fn(),
  findIncomeById: vi.fn(),
  listIncome: vi.fn(),
  markIncomeVoided: vi.fn(),
}));
vi.mock("@/repositories/LedgerRepository", () => ({
  createLedgerEntry: vi.fn(),
  findLedgerEntryForIncome: vi.fn(),
}));
vi.mock("@/services/AuditService", () => ({ recordAudit: vi.fn() }));
vi.mock("@/services/FinancialPeriodService", () => ({ assertPeriodOpenForDate: vi.fn() }));
vi.mock("@/services/LedgerService", () => ({ ensureOpeningBalanceEntry: vi.fn() }));
vi.mock("@/services/ReversalService", () => ({ reverseLedgerEntry: vi.fn() }));

import { Prisma } from "@prisma/client";

import {
  createPostedIncome,
  findIncomeByIdempotencyKey,
} from "@/repositories/IncomeTransactionRepository";
import {
  findActiveFinancialAccount,
  findActiveFundSource,
  findActiveIncomeCategory,
} from "@/repositories/FinancialLookupRepository";
import { recordIncome } from "@/services/IncomeService";

const SESSION = {
  userId: "bendahara-1",
  schoolId: "school-a",
  roleCode: "BENDAHARA",
  email: "b@sikep.test",
};

const input = {
  financialAccountId: "acc-1",
  fundSourceId: "fs-1",
  categoryId: "cat-1",
  amount: "500000.00",
  transactionDate: new Date("2026-09-19"),
  description: "SPP September",
};

const IDEMPOTENCY_KEY = "client-retry-key-abc";

function uniqueConstraintViolation() {
  return new Prisma.PrismaClientKnownRequestError("duplicate", {
    code: "P2002",
    clientVersion: "7.10.0",
  });
}

describe("integration/idempotency — client retries POST /api/v1/income with the same key", () => {
  let fakeTable: { id: string; status: string; amount: string } | null;

  beforeEach(() => {
    fakeTable = null;

    vi.mocked(findActiveFinancialAccount)
      .mockReset()
      .mockResolvedValue({ id: "acc-1" } as never);
    vi.mocked(findActiveFundSource)
      .mockReset()
      .mockResolvedValue({ id: "fs-1" } as never);
    vi.mocked(findActiveIncomeCategory)
      .mockReset()
      .mockResolvedValue({ id: "cat-1" } as never);

    vi.mocked(findIncomeByIdempotencyKey)
      .mockReset()
      .mockImplementation(async () => {
        return fakeTable as never;
      });
  });

  it("sequential retry: the second call finds the first call's committed row and does not re-post", async () => {
    vi.mocked(createPostedIncome)
      .mockReset()
      .mockImplementation(async (_tx, data) => {
        const created = { id: "inc-1", status: "POSTED", amount: data.amount };
        fakeTable = created;
        return created as never;
      });

    const first = await recordIncome(SESSION, input, IDEMPOTENCY_KEY);
    expect(first.replayed).toBe(false);
    expect(createPostedIncome).toHaveBeenCalledTimes(1);

    const second = await recordIncome(SESSION, input, IDEMPOTENCY_KEY);
    expect(second.replayed).toBe(true);
    expect(second.income).toEqual(first.income);
    expect(createPostedIncome).toHaveBeenCalledTimes(1); // still just once — no double-post
  });

  it("racing retry: the loser's insert hits the unique constraint and returns the winner's row instead of double-posting", async () => {
    let insertAttempts = 0;
    vi.mocked(createPostedIncome)
      .mockReset()
      .mockImplementation(async (_tx, data) => {
        insertAttempts++;
        if (insertAttempts === 1) {
          // Winner: "commits" first.
          const created = { id: "inc-winner", status: "POSTED", amount: data.amount };
          fakeTable = created;
          return created as never;
        }
        // Loser: the unique index on idempotency_key rejects it.
        throw uniqueConstraintViolation();
      });

    // Both requests' findExisting() miss (fakeTable still null when each
    // reads it) because neither has awaited past that point yet — model
    // this explicitly rather than relying on incidental Promise ordering.
    const [a, b] = await Promise.all([
      recordIncome(SESSION, input, IDEMPOTENCY_KEY),
      recordIncome(SESSION, input, IDEMPOTENCY_KEY),
    ]);

    // Exactly one insert actually "won"; both callers end up with the same row.
    expect(a.income).toEqual(b.income);
    expect(insertAttempts).toBe(2);
    expect([a.replayed, b.replayed].filter(Boolean)).toHaveLength(1); // exactly one was a replay
  });
});
