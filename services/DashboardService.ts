import { Prisma } from "@prisma/client";

import type { SessionPayload } from "@/lib/auth/session";
import {
  countBillsByStatus,
  countPendingApprovals,
  listActiveFinancialAccounts,
  listRecentPostedExpense,
  listRecentPostedIncome,
  sumOutstandingBillAmount,
  sumPostedTransactionsInRange,
} from "@/repositories/DashboardRepository";
import { getAccountBalanceWithRetry } from "@/services/LedgerService";

const MONTHLY_TREND_MONTHS = 6;
const RECENT_TRANSACTIONS_LIMIT = 10;

export interface AccountBalanceRow {
  id: string;
  name: string;
  type: string;
  balance: string;
}

export interface MonthlyTrendRow {
  month: string; // "YYYY-MM"
  income: string;
  expense: string;
}

export interface RecentTransactionRow {
  id: string;
  kind: "INCOME" | "EXPENSE";
  category: string;
  amount: string;
  transactionDate: Date;
  description: string | null;
}

export interface DashboardSummary {
  accounts: AccountBalanceRow[];
  totalBalance: string;
  currentMonth: {
    income: string;
    expense: string;
    net: string;
  };
  pendingApprovalCount: number;
  billStatus: {
    unpaid: number;
    partial: number;
    paid: number;
    outstandingAmount: string;
  };
  monthlyTrend: MonthlyTrendRow[];
  recentTransactions: RecentTransactionRow[];
}

function monthRange(monthsAgo: number): { from: Date; to: Date; label: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + 1, 1));
  const label = `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}`;
  return { from, to, label };
}

export async function getDashboardSummary(session: SessionPayload): Promise<DashboardSummary> {
  const { schoolId } = session;

  const activeAccounts = await listActiveFinancialAccounts(schoolId);
  const balances = await Promise.all(
    activeAccounts.map((account) => getAccountBalanceWithRetry(schoolId, account.id)),
  );
  const accounts: AccountBalanceRow[] = activeAccounts.map((account, i) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    balance: balances[i].toString(),
  }));
  const totalBalance = balances.reduce((sum, b) => sum.plus(b), new Prisma.Decimal(0)).toString();

  const currentRange = monthRange(0);
  const [currentIncome, currentExpense] = await Promise.all([
    sumPostedTransactionsInRange(schoolId, "INCOME", currentRange.from, currentRange.to),
    sumPostedTransactionsInRange(schoolId, "EXPENSE", currentRange.from, currentRange.to),
  ]);
  const currentIncomeDecimal = currentIncome ?? new Prisma.Decimal(0);
  const currentExpenseDecimal = currentExpense ?? new Prisma.Decimal(0);

  const pendingApprovalCount = await countPendingApprovals(schoolId);

  const [billStatusGroups, outstanding] = await Promise.all([
    countBillsByStatus(schoolId),
    sumOutstandingBillAmount(schoolId),
  ]);
  const countFor = (status: string) =>
    billStatusGroups.find((g) => g.status === status)?._count._all ?? 0;
  const outstandingAmount = (outstanding.totalAmount ?? new Prisma.Decimal(0))
    .minus(outstanding.totalPaid ?? new Prisma.Decimal(0))
    .toString();

  const monthlyTrend: MonthlyTrendRow[] = [];
  for (let i = MONTHLY_TREND_MONTHS - 1; i >= 0; i--) {
    const range = monthRange(i);
    const [income, expense] = await Promise.all([
      sumPostedTransactionsInRange(schoolId, "INCOME", range.from, range.to),
      sumPostedTransactionsInRange(schoolId, "EXPENSE", range.from, range.to),
    ]);
    monthlyTrend.push({
      month: range.label,
      income: (income ?? new Prisma.Decimal(0)).toString(),
      expense: (expense ?? new Prisma.Decimal(0)).toString(),
    });
  }

  const [recentIncome, recentExpense] = await Promise.all([
    listRecentPostedIncome(schoolId, RECENT_TRANSACTIONS_LIMIT),
    listRecentPostedExpense(schoolId, RECENT_TRANSACTIONS_LIMIT),
  ]);
  const recentTransactions: RecentTransactionRow[] = [
    ...recentIncome.map((t) => ({
      id: t.id,
      kind: "INCOME" as const,
      category: t.category.name,
      amount: t.amount.toString(),
      transactionDate: t.transactionDate,
      description: t.description,
    })),
    ...recentExpense.map((t) => ({
      id: t.id,
      kind: "EXPENSE" as const,
      category: t.category.name,
      amount: t.amount.toString(),
      transactionDate: t.transactionDate,
      description: t.description,
    })),
  ]
    .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime())
    .slice(0, RECENT_TRANSACTIONS_LIMIT);

  return {
    accounts,
    totalBalance,
    currentMonth: {
      income: currentIncomeDecimal.toString(),
      expense: currentExpenseDecimal.toString(),
      net: currentIncomeDecimal.minus(currentExpenseDecimal).toString(),
    },
    pendingApprovalCount,
    billStatus: {
      unpaid: countFor("UNPAID"),
      partial: countFor("PARTIAL"),
      paid: countFor("PAID"),
      outstandingAmount,
    },
    monthlyTrend,
    recentTransactions,
  };
}
