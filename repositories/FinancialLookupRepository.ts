import type { FinancialAccount, FundSource, TransactionCategory } from "@prisma/client";

import type { Tx } from "@/repositories/LedgerRepository";

/**
 * Tenant-scoped existence/validity lookups shared by IncomeService and
 * ExpenseService — kept here (not inline `tx.xxx` calls in the services)
 * so the architecture rule "service never calls Prisma directly" holds
 * for transaction-scoped code too, and so these lookups are mockable in
 * service-layer unit tests without needing a fake Prisma transaction client.
 */

export async function findActiveFinancialAccount(
  tx: Tx,
  schoolId: string,
  id: string,
): Promise<FinancialAccount | null> {
  return tx.financialAccount.findFirst({ where: { id, schoolId, deletedAt: null } });
}

export async function findActiveFundSource(
  tx: Tx,
  schoolId: string,
  id: string,
): Promise<FundSource | null> {
  return tx.fundSource.findFirst({ where: { id, schoolId, deletedAt: null } });
}

export async function findActiveIncomeCategory(
  tx: Tx,
  schoolId: string,
  id: string,
): Promise<TransactionCategory | null> {
  return tx.transactionCategory.findFirst({
    where: { id, schoolId, deletedAt: null, type: "INCOME" },
  });
}

export async function findActiveExpenseCategory(
  tx: Tx,
  schoolId: string,
  id: string,
): Promise<TransactionCategory | null> {
  return tx.transactionCategory.findFirst({
    where: { id, schoolId, deletedAt: null, type: "EXPENSE" },
  });
}
