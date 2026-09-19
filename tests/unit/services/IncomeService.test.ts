import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { NotFoundError, ForbiddenError } from "@/lib/errors";
import {
  findActiveFinancialAccount,
  findActiveFundSource,
  findActiveIncomeCategory,
} from "@/repositories/FinancialLookupRepository";
import {
  createPostedIncome,
  findIncomeByIdempotencyKey,
  findIncomeById,
  markIncomeVoided,
} from "@/repositories/IncomeTransactionRepository";
import { createLedgerEntry, findLedgerEntryForIncome } from "@/repositories/LedgerRepository";
import { recordAudit } from "@/services/AuditService";
import { assertPeriodOpenForDate } from "@/services/FinancialPeriodService";
import { recordIncome, voidIncome } from "@/services/IncomeService";
import { reverseLedgerEntry } from "@/services/ReversalService";

const SESSION = {
  userId: "u1",
  schoolId: "school-a",
  roleCode: "BENDAHARA",
  email: "b@sikep.test",
};

const validInput = {
  financialAccountId: "acc-1",
  fundSourceId: "fs-1",
  categoryId: "cat-1",
  amount: "500000.00",
  transactionDate: new Date("2026-09-18"),
  description: "SPP September",
};

describe("services/IncomeService.recordIncome", () => {
  beforeEach(() => {
    vi.mocked(findActiveFinancialAccount)
      .mockReset()
      .mockResolvedValue({ id: "acc-1" } as never);
    vi.mocked(findActiveFundSource)
      .mockReset()
      .mockResolvedValue({ id: "fs-1" } as never);
    vi.mocked(findActiveIncomeCategory)
      .mockReset()
      .mockResolvedValue({ id: "cat-1" } as never);
    vi.mocked(findIncomeByIdempotencyKey).mockReset().mockResolvedValue(null);
    vi.mocked(createPostedIncome)
      .mockReset()
      .mockResolvedValue({ id: "inc-1", status: "POSTED" } as never);
    vi.mocked(createLedgerEntry).mockReset();
    vi.mocked(recordAudit).mockReset();
    vi.mocked(assertPeriodOpenForDate).mockReset().mockResolvedValue(undefined);
  });

  it("propagates FinancialIntegrityError when the transaction date falls in a closed period", async () => {
    const { FinancialIntegrityError } = await import("@/lib/errors");
    vi.mocked(assertPeriodOpenForDate).mockRejectedValue(
      new FinancialIntegrityError("Periode sudah ditutup."),
    );

    await expect(recordIncome(SESSION, validInput, undefined)).rejects.toBeInstanceOf(
      FinancialIntegrityError,
    );
    expect(createPostedIncome).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when the financial account doesn't belong to this school", async () => {
    vi.mocked(findActiveFinancialAccount).mockResolvedValue(null);
    await expect(recordIncome(SESSION, validInput, undefined)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws NotFoundError when the category isn't an INCOME-type category", async () => {
    vi.mocked(findActiveIncomeCategory).mockResolvedValue(null);
    await expect(recordIncome(SESSION, validInput, undefined)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("posts the income immediately (no approval gate) and audits it as POST", async () => {
    const result = await recordIncome(SESSION, validInput, undefined);

    expect(result.replayed).toBe(false);
    expect(createLedgerEntry).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        entryType: "INCOME",
        amount: "500000.00",
        incomeTransactionId: "inc-1",
      }),
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "POST", entityType: "IncomeTransaction" }),
    );
  });

  it("replays an existing record instead of posting again for a reused Idempotency-Key", async () => {
    vi.mocked(findIncomeByIdempotencyKey).mockResolvedValue({ id: "inc-existing" } as never);

    const result = await recordIncome(SESSION, validInput, "key-123");

    expect(result).toEqual({ income: { id: "inc-existing" }, replayed: true });
    expect(createPostedIncome).not.toHaveBeenCalled();
    expect(createLedgerEntry).not.toHaveBeenCalled();
  });
});

describe("services/IncomeService.voidIncome", () => {
  beforeEach(() => {
    vi.mocked(findIncomeById).mockReset();
    vi.mocked(markIncomeVoided).mockReset();
    vi.mocked(findLedgerEntryForIncome).mockReset();
    vi.mocked(reverseLedgerEntry).mockReset();
    vi.mocked(recordAudit).mockReset();
  });

  it("throws NotFoundError for a nonexistent income transaction", async () => {
    vi.mocked(findIncomeById).mockResolvedValue(null);
    await expect(voidIncome(SESSION, "ghost", "alasan")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses to void a transaction that isn't POSTED", async () => {
    vi.mocked(findIncomeById).mockResolvedValue({ id: "inc-1", status: "DRAFT" } as never);
    await expect(voidIncome(SESSION, "inc-1", "alasan")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("marks the transaction VOIDED and posts a reversal for a POSTED transaction", async () => {
    vi.mocked(findIncomeById).mockResolvedValue({ id: "inc-1", status: "POSTED" } as never);
    vi.mocked(markIncomeVoided).mockResolvedValue({ id: "inc-1", status: "VOIDED" } as never);
    vi.mocked(findLedgerEntryForIncome).mockResolvedValue({
      id: "ledger-1",
      financialAccountId: "acc-1",
    } as never);
    vi.mocked(reverseLedgerEntry).mockResolvedValue({ reversalEntry: { id: "rev-1" } } as never);

    const result = await voidIncome(SESSION, "inc-1", "Salah catat");

    expect(result).toEqual({ id: "inc-1", status: "VOIDED" });
    expect(reverseLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        originalEntityType: "INCOME_TRANSACTION",
        originalEntityId: "inc-1",
      }),
    );
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "VOID" }));
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "REVERSAL" }));
  });
});
