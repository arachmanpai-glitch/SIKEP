import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/LedgerRepository", async () => {
  const actual = await vi.importActual<typeof import("@/repositories/LedgerRepository")>(
    "@/repositories/LedgerRepository",
  );
  return { ...actual, createLedgerEntry: vi.fn() };
});

import { createLedgerEntry } from "@/repositories/LedgerRepository";
import { reverseLedgerEntry } from "@/services/ReversalService";

function fakeTx() {
  return { reversalTransaction: { create: vi.fn() } } as unknown as {
    reversalTransaction: { create: ReturnType<typeof vi.fn> };
  };
}

describe("services/ReversalService.reverseLedgerEntry", () => {
  beforeEach(() => {
    vi.mocked(createLedgerEntry).mockReset();
  });

  it("posts a REVERSAL ledger entry with the opposite sign of the original", async () => {
    const tx = fakeTx();
    const reversalRow = { id: "rev-1" };
    vi.mocked(createLedgerEntry).mockResolvedValue(reversalRow as never);

    await reverseLedgerEntry({
      tx: tx as never,
      schoolId: "school-a",
      reversedById: "user-1",
      reason: "Salah input",
      originalEntityType: "EXPENSE_TRANSACTION",
      originalEntityId: "exp-1",
      originalLedgerEntry: {
        financialAccountId: "acc-1",
        amount: new Prisma.Decimal("-500000.00"),
      } as never,
    });

    expect(createLedgerEntry).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        entryType: "REVERSAL",
        financialAccountId: "acc-1",
        expenseTransactionId: "exp-1",
      }),
    );
    const call = vi.mocked(createLedgerEntry).mock.calls[0][1];
    expect((call.amount as Prisma.Decimal).toString()).toBe("500000");
  });

  it("records a reversal_transactions row linking to the new ledger entry", async () => {
    const tx = fakeTx();
    const reversalRow = { id: "rev-2" };
    vi.mocked(createLedgerEntry).mockResolvedValue(reversalRow as never);

    await reverseLedgerEntry({
      tx: tx as never,
      schoolId: "school-a",
      reversedById: "user-1",
      reason: "Duplikat",
      originalEntityType: "INCOME_TRANSACTION",
      originalEntityId: "inc-1",
      originalLedgerEntry: {
        financialAccountId: "acc-1",
        amount: new Prisma.Decimal("300000.00"),
      } as never,
    });

    expect(tx.reversalTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        originalEntityType: "INCOME_TRANSACTION",
        originalEntityId: "inc-1",
        reason: "Duplikat",
        reversedById: "user-1",
        ledgerEntryId: "rev-2",
      }),
    });
  });
});
