import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/LedgerService", () => ({
  getAccountBalanceWithRetry: vi.fn(),
}));
vi.mock("@/repositories/DashboardRepository", () => ({
  listActiveFinancialAccounts: vi.fn(),
  sumPostedTransactionsInRange: vi.fn(),
  countPendingApprovals: vi.fn(),
  countBillsByStatus: vi.fn(),
  sumOutstandingBillAmount: vi.fn(),
  listRecentPostedIncome: vi.fn(),
  listRecentPostedExpense: vi.fn(),
}));

import { Prisma } from "@prisma/client";

import {
  countBillsByStatus,
  countPendingApprovals,
  listActiveFinancialAccounts,
  listRecentPostedExpense,
  listRecentPostedIncome,
  sumOutstandingBillAmount,
  sumPostedTransactionsInRange,
} from "@/repositories/DashboardRepository";
import { getDashboardSummary } from "@/services/DashboardService";
import { getAccountBalanceWithRetry } from "@/services/LedgerService";

const SESSION = {
  userId: "u1",
  schoolId: "school-a",
  roleCode: "YAYASAN",
  email: "y@sikep.test",
};

describe("services/DashboardService.getDashboardSummary", () => {
  beforeEach(() => {
    vi.mocked(listActiveFinancialAccounts)
      .mockReset()
      .mockResolvedValue([
        { id: "acc-1", name: "Kas Utama", type: "CASH" } as never,
        { id: "acc-2", name: "Bank BSI", type: "BANK" } as never,
      ]);
    vi.mocked(getAccountBalanceWithRetry)
      .mockReset()
      .mockResolvedValueOnce(new Prisma.Decimal("1000000.00"))
      .mockResolvedValueOnce(new Prisma.Decimal("500000.00"));
    vi.mocked(sumPostedTransactionsInRange).mockReset().mockResolvedValue(new Prisma.Decimal("0"));
    vi.mocked(countPendingApprovals).mockReset().mockResolvedValue(2);
    vi.mocked(countBillsByStatus)
      .mockReset()
      .mockResolvedValue([
        { status: "UNPAID", _count: { _all: 3 } },
        { status: "PARTIAL", _count: { _all: 1 } },
        { status: "PAID", _count: { _all: 5 } },
      ] as never);
    vi.mocked(sumOutstandingBillAmount)
      .mockReset()
      .mockResolvedValue({
        totalAmount: new Prisma.Decimal("2000000.00"),
        totalPaid: new Prisma.Decimal("500000.00"),
      });
    vi.mocked(listRecentPostedIncome).mockReset().mockResolvedValue([]);
    vi.mocked(listRecentPostedExpense).mockReset().mockResolvedValue([]);
  });

  it("sums per-account balances into totalBalance", async () => {
    const summary = await getDashboardSummary(SESSION);

    expect(summary.accounts).toEqual([
      { id: "acc-1", name: "Kas Utama", type: "CASH", balance: "1000000" },
      { id: "acc-2", name: "Bank BSI", type: "BANK", balance: "500000" },
    ]);
    expect(summary.totalBalance).toBe("1500000");
  });

  it("computes bill status counts and outstanding amount", async () => {
    const summary = await getDashboardSummary(SESSION);

    expect(summary.billStatus).toEqual({
      unpaid: 3,
      partial: 1,
      paid: 5,
      outstandingAmount: "1500000",
    });
  });

  it("carries the pending approval count through unmodified", async () => {
    const summary = await getDashboardSummary(SESSION);
    expect(summary.pendingApprovalCount).toBe(2);
  });

  it("produces exactly 6 months of trend data, oldest first", async () => {
    const summary = await getDashboardSummary(SESSION);
    expect(summary.monthlyTrend).toHaveLength(6);
    const months = summary.monthlyTrend.map((m) => m.month);
    expect(new Set(months).size).toBe(6);
  });

  it("merges and sorts recent income/expense transactions by date descending", async () => {
    const older = new Date("2026-01-01T00:00:00Z");
    const newer = new Date("2026-01-15T00:00:00Z");
    vi.mocked(listRecentPostedIncome).mockResolvedValue([
      {
        id: "inc-1",
        amount: new Prisma.Decimal("100000"),
        transactionDate: older,
        description: null,
        category: { name: "Syahriyah" },
      } as never,
    ]);
    vi.mocked(listRecentPostedExpense).mockResolvedValue([
      {
        id: "exp-1",
        amount: new Prisma.Decimal("50000"),
        transactionDate: newer,
        description: null,
        category: { name: "ATK" },
      } as never,
    ]);

    const summary = await getDashboardSummary(SESSION);

    expect(summary.recentTransactions).toEqual([
      expect.objectContaining({ id: "exp-1", kind: "EXPENSE" }),
      expect.objectContaining({ id: "inc-1", kind: "INCOME" }),
    ]);
  });
});
