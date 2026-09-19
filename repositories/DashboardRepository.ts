import type { BillStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Read-only aggregate queries for `services/DashboardService.ts`. Kept
 * separate from `FinancialLookupRepository.ts` (tx-scoped existence checks
 * used inside financial mutations) — these are top-level `prisma` reads with
 * no transactional requirement, reaching across multiple aggregate roots
 * (accounts, bills, approvals, transactions) purely to summarize them.
 */

export async function listActiveFinancialAccounts(schoolId: string) {
  return prisma.financialAccount.findMany({
    where: { schoolId, deletedAt: null, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function sumPostedTransactionsInRange(
  schoolId: string,
  type: "INCOME" | "EXPENSE",
  from: Date,
  to: Date,
) {
  const where = { schoolId, status: "POSTED" as const, transactionDate: { gte: from, lt: to } };
  const result =
    type === "INCOME"
      ? await prisma.incomeTransaction.aggregate({ where, _sum: { amount: true } })
      : await prisma.expenseTransaction.aggregate({ where, _sum: { amount: true } });
  return result._sum.amount;
}

export async function countPendingApprovals(schoolId: string): Promise<number> {
  return prisma.approvalRequest.count({ where: { schoolId, status: "PENDING" } });
}

/** Grouped by status, excluding VOIDED (spec section 12 doesn't track voided
 * bills as outstanding — a voided bill was never really owed). */
export async function countBillsByStatus(schoolId: string) {
  return prisma.santriBill.groupBy({
    by: ["status"],
    where: { schoolId, deletedAt: null, status: { not: "VOIDED" } },
    _count: { _all: true },
  });
}

export async function sumOutstandingBillAmount(schoolId: string) {
  const result = await prisma.santriBill.aggregate({
    where: { schoolId, deletedAt: null, status: { in: ["UNPAID", "PARTIAL"] as BillStatus[] } },
    _sum: { amount: true, amountPaid: true },
  });
  return {
    totalAmount: result._sum.amount,
    totalPaid: result._sum.amountPaid,
  };
}

export async function listRecentPostedIncome(schoolId: string, limit: number) {
  return prisma.incomeTransaction.findMany({
    where: { schoolId, status: "POSTED" },
    orderBy: { transactionDate: "desc" },
    take: limit,
    include: { category: true },
  });
}

export async function listRecentPostedExpense(schoolId: string, limit: number) {
  return prisma.expenseTransaction.findMany({
    where: { schoolId, status: "POSTED" },
    orderBy: { transactionDate: "desc" },
    take: limit,
    include: { category: true },
  });
}
