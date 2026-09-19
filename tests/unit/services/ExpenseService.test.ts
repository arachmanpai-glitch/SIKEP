import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})),
  },
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

import { FinancialIntegrityError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { createPendingApprovalRequest } from "@/repositories/ApprovalRequestRepository";
import { getOrCreateApprovalSettings } from "@/repositories/ApprovalSettingsRepository";
import {
  createPendingApprovalExpense,
  createPostedExpense,
  findExpenseByIdempotencyKey,
  findExpenseById,
  markExpenseVoided,
} from "@/repositories/ExpenseTransactionRepository";
import {
  findActiveExpenseCategory,
  findActiveFinancialAccount,
} from "@/repositories/FinancialLookupRepository";
import { createLedgerEntry, findLedgerEntryForExpense } from "@/repositories/LedgerRepository";
import { recordAudit } from "@/services/AuditService";
import { submitExpense, voidExpense } from "@/services/ExpenseService";
import { assertPeriodOpenForDate } from "@/services/FinancialPeriodService";
import { getAccountBalance } from "@/services/LedgerService";
import { reverseLedgerEntry } from "@/services/ReversalService";

const SESSION = {
  userId: "u1",
  schoolId: "school-a",
  roleCode: "BENDAHARA",
  email: "b@sikep.test",
};

const baseInput = {
  financialAccountId: "acc-1",
  categoryId: "cat-1",
  amount: "300000.00",
  transactionDate: new Date("2026-09-18"),
  description: "Beli ATK",
};

function decimalSettings(overrides: { threshold?: string; allowNegativeBalance?: boolean } = {}) {
  return {
    id: "as1",
    schoolId: "school-a",
    expenseApprovalThreshold: new Prisma.Decimal(overrides.threshold ?? "1000000.00"),
    allowNegativeBalance: overrides.allowNegativeBalance ?? false,
  };
}

describe("services/ExpenseService.submitExpense", () => {
  beforeEach(() => {
    vi.mocked(findActiveExpenseCategory)
      .mockReset()
      .mockResolvedValue({ id: "cat-1", requiresApproval: false } as never);
    vi.mocked(findActiveFinancialAccount)
      .mockReset()
      .mockResolvedValue({ id: "acc-1" } as never);
    vi.mocked(getOrCreateApprovalSettings)
      .mockReset()
      .mockResolvedValue(decimalSettings() as never);
    vi.mocked(getAccountBalance).mockReset().mockResolvedValue(new Prisma.Decimal("2000000.00"));
    vi.mocked(findExpenseByIdempotencyKey).mockReset().mockResolvedValue(null);
    vi.mocked(createPostedExpense)
      .mockReset()
      .mockResolvedValue({ id: "exp-1", status: "POSTED" } as never);
    vi.mocked(createPendingApprovalExpense)
      .mockReset()
      .mockResolvedValue({ id: "exp-2", status: "PENDING_APPROVAL" } as never);
    vi.mocked(createPendingApprovalRequest).mockReset();
    vi.mocked(createLedgerEntry).mockReset();
    vi.mocked(recordAudit).mockReset();
    vi.mocked(assertPeriodOpenForDate).mockReset().mockResolvedValue(undefined);
  });

  it("propagates FinancialIntegrityError when the transaction date falls in a closed period (direct-post path)", async () => {
    vi.mocked(assertPeriodOpenForDate).mockRejectedValue(
      new FinancialIntegrityError("Periode sudah ditutup."),
    );

    await expect(submitExpense(SESSION, baseInput, undefined)).rejects.toBeInstanceOf(
      FinancialIntegrityError,
    );
    expect(createPostedExpense).not.toHaveBeenCalled();
  });

  it("propagates FinancialIntegrityError when the transaction date falls in a closed period (submit-for-approval path)", async () => {
    vi.mocked(assertPeriodOpenForDate).mockRejectedValue(
      new FinancialIntegrityError("Periode sudah ditutup."),
    );

    await expect(
      submitExpense(SESSION, { ...baseInput, amount: "1500000.00" }, undefined),
    ).rejects.toBeInstanceOf(FinancialIntegrityError);
    expect(createPendingApprovalExpense).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when the category isn't an EXPENSE-type category for this school", async () => {
    vi.mocked(findActiveExpenseCategory).mockResolvedValue(null);
    await expect(submitExpense(SESSION, baseInput, undefined)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("posts immediately when the amount is under threshold and the category doesn't require approval", async () => {
    const result = await submitExpense(SESSION, baseInput, undefined);

    expect(result.expense.status).toBe("POSTED");
    expect(createPostedExpense).toHaveBeenCalled();
    expect(createLedgerEntry).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ entryType: "EXPENSE", expenseTransactionId: "exp-1" }),
    );
    const ledgerCall = vi.mocked(createLedgerEntry).mock.calls[0][1];
    expect((ledgerCall.amount as Prisma.Decimal).toString()).toBe("-300000");
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "POST" }));
  });

  it("parks PENDING_APPROVAL (without touching the ledger) when amount >= threshold", async () => {
    const result = await submitExpense(SESSION, { ...baseInput, amount: "1500000.00" }, undefined);

    expect(result.expense.status).toBe("PENDING_APPROVAL");
    expect(createPendingApprovalExpense).toHaveBeenCalled();
    expect(createPendingApprovalRequest).toHaveBeenCalled();
    expect(createLedgerEntry).not.toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "SUBMIT" }));
  });

  it("parks PENDING_APPROVAL when the category itself always requires approval, even under threshold", async () => {
    vi.mocked(findActiveExpenseCategory).mockResolvedValue({
      id: "cat-1",
      requiresApproval: true,
    } as never);

    const result = await submitExpense(SESSION, baseInput, undefined);

    expect(result.expense.status).toBe("PENDING_APPROVAL");
    expect(createLedgerEntry).not.toHaveBeenCalled();
  });

  it("rejects with FinancialIntegrityError when posting would overdraw the account and allowNegativeBalance is false", async () => {
    vi.mocked(getAccountBalance).mockResolvedValue(new Prisma.Decimal("100000.00"));

    await expect(
      submitExpense(SESSION, { ...baseInput, amount: "300000.00" }, undefined),
    ).rejects.toBeInstanceOf(FinancialIntegrityError);
    expect(createPostedExpense).not.toHaveBeenCalled();
    expect(createLedgerEntry).not.toHaveBeenCalled();
  });

  it("allows overdrawing the account when allowNegativeBalance is true", async () => {
    vi.mocked(getAccountBalance).mockResolvedValue(new Prisma.Decimal("100000.00"));
    vi.mocked(getOrCreateApprovalSettings).mockResolvedValue(
      decimalSettings({ allowNegativeBalance: true }) as never,
    );

    const result = await submitExpense(SESSION, { ...baseInput, amount: "300000.00" }, undefined);

    expect(result.expense.status).toBe("POSTED");
  });

  it("replays an existing record for a reused Idempotency-Key on the posted path", async () => {
    vi.mocked(findExpenseByIdempotencyKey).mockResolvedValue({
      id: "exp-existing",
      status: "POSTED",
    } as never);

    const result = await submitExpense(SESSION, baseInput, "key-abc");

    expect(result).toEqual({ expense: { id: "exp-existing", status: "POSTED" }, replayed: true });
    expect(createPostedExpense).not.toHaveBeenCalled();
    expect(createLedgerEntry).not.toHaveBeenCalled();
  });
});

describe("services/ExpenseService.voidExpense", () => {
  beforeEach(() => {
    vi.mocked(findExpenseById).mockReset();
    vi.mocked(markExpenseVoided).mockReset();
    vi.mocked(findLedgerEntryForExpense).mockReset();
    vi.mocked(reverseLedgerEntry).mockReset();
    vi.mocked(recordAudit).mockReset();
  });

  it("throws NotFoundError for a nonexistent expense", async () => {
    vi.mocked(findExpenseById).mockResolvedValue(null);
    await expect(voidExpense(SESSION, "ghost", "alasan")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses to void a PENDING_APPROVAL expense (never posted, nothing to reverse)", async () => {
    vi.mocked(findExpenseById).mockResolvedValue({
      id: "exp-1",
      status: "PENDING_APPROVAL",
    } as never);
    await expect(voidExpense(SESSION, "exp-1", "alasan")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("voids a POSTED expense and posts a reversal", async () => {
    vi.mocked(findExpenseById).mockResolvedValue({ id: "exp-1", status: "POSTED" } as never);
    vi.mocked(markExpenseVoided).mockResolvedValue({ id: "exp-1", status: "VOIDED" } as never);
    vi.mocked(findLedgerEntryForExpense).mockResolvedValue({
      id: "ledger-1",
      financialAccountId: "acc-1",
    } as never);
    vi.mocked(reverseLedgerEntry).mockResolvedValue({ reversalEntry: { id: "rev-1" } } as never);

    const result = await voidExpense(SESSION, "exp-1", "Salah kategori");

    expect(result).toEqual({ id: "exp-1", status: "VOIDED" });
    expect(reverseLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        originalEntityType: "EXPENSE_TRANSACTION",
        originalEntityId: "exp-1",
      }),
    );
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "VOID" }));
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "REVERSAL" }));
  });
});
