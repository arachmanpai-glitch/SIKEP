import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/LedgerRepository", async () => {
  const actual = await vi.importActual<typeof import("@/repositories/LedgerRepository")>(
    "@/repositories/LedgerRepository",
  );
  return {
    ...actual,
    createLedgerEntry: vi.fn(),
    sumLedgerAmount: vi.fn(),
    findOpeningBalanceEntry: vi.fn(),
  };
});

import {
  createLedgerEntry,
  findOpeningBalanceEntry,
  sumLedgerAmount,
} from "@/repositories/LedgerRepository";
import { ensureOpeningBalanceEntry, getAccountBalance } from "@/services/LedgerService";

const fakeTx = {
  financialAccount: { findFirst: vi.fn() },
} as never;

describe("services/LedgerService", () => {
  beforeEach(() => {
    vi.mocked(createLedgerEntry).mockReset();
    vi.mocked(sumLedgerAmount).mockReset();
    vi.mocked(findOpeningBalanceEntry).mockReset();
    (
      fakeTx as { financialAccount: { findFirst: ReturnType<typeof vi.fn> } }
    ).financialAccount.findFirst.mockReset();
  });

  describe("ensureOpeningBalanceEntry", () => {
    it("does nothing if an OPENING_BALANCE entry already exists", async () => {
      vi.mocked(findOpeningBalanceEntry).mockResolvedValue({ id: "existing" } as never);

      await ensureOpeningBalanceEntry(fakeTx, "school-a", "account-1");

      expect(createLedgerEntry).not.toHaveBeenCalled();
    });

    it("posts an OPENING_BALANCE entry from the account's opening_balance field when missing", async () => {
      vi.mocked(findOpeningBalanceEntry).mockResolvedValue(null);
      (
        fakeTx as { financialAccount: { findFirst: ReturnType<typeof vi.fn> } }
      ).financialAccount.findFirst.mockResolvedValue({
        id: "account-1",
        openingBalance: new Prisma.Decimal("500000.00"),
      });

      await ensureOpeningBalanceEntry(fakeTx, "school-a", "account-1");

      expect(createLedgerEntry).toHaveBeenCalledWith(
        fakeTx,
        expect.objectContaining({
          entryType: "OPENING_BALANCE",
          financialAccountId: "account-1",
          referenceType: "OPENING_BALANCE",
          referenceId: "account-1",
        }),
      );
    });

    it("skips posting when the opening balance is zero (nothing meaningful to record)", async () => {
      vi.mocked(findOpeningBalanceEntry).mockResolvedValue(null);
      (
        fakeTx as { financialAccount: { findFirst: ReturnType<typeof vi.fn> } }
      ).financialAccount.findFirst.mockResolvedValue({
        id: "account-1",
        openingBalance: new Prisma.Decimal("0.00"),
      });

      await ensureOpeningBalanceEntry(fakeTx, "school-a", "account-1");

      expect(createLedgerEntry).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when the account doesn't exist for this school", async () => {
      vi.mocked(findOpeningBalanceEntry).mockResolvedValue(null);
      (
        fakeTx as { financialAccount: { findFirst: ReturnType<typeof vi.fn> } }
      ).financialAccount.findFirst.mockResolvedValue(null);

      const { NotFoundError } = await import("@/lib/errors");
      await expect(ensureOpeningBalanceEntry(fakeTx, "school-a", "ghost")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("getAccountBalance", () => {
    it("returns the SUM of ledger entries (opening balance already ensured)", async () => {
      vi.mocked(findOpeningBalanceEntry).mockResolvedValue({ id: "existing" } as never);
      vi.mocked(sumLedgerAmount).mockResolvedValue(new Prisma.Decimal("1200000.00"));

      const balance = await getAccountBalance(fakeTx, "school-a", "account-1");

      expect(balance.toString()).toBe("1200000");
    });
  });
});
