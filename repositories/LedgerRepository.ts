import { Prisma } from "@prisma/client";
import type { FinancialEntityType, LedgerEntryType } from "@prisma/client";

/**
 * All functions here take a Prisma transaction client (`tx`), never the
 * top-level `prisma` singleton — every ledger read/write MUST happen
 * inside the same DB transaction as the source mutation (income/expense
 * posting, reversal), per spec section 8/10. Called exclusively from
 * services/LedgerService.ts.
 */
export type Tx = Prisma.TransactionClient;

export interface CreateLedgerEntryData {
  schoolId: string;
  financialAccountId: string;
  entryType: LedgerEntryType;
  /** Signed: positive increases balance, negative decreases it. */
  amount: Prisma.Decimal | string;
  referenceType: FinancialEntityType;
  referenceId: string;
  incomeTransactionId?: string;
  expenseTransactionId?: string;
  description?: string;
}

export async function createLedgerEntry(tx: Tx, data: CreateLedgerEntryData) {
  return tx.financialLedger.create({ data });
}

/** SUM of every posted ledger entry for the account — the account's
 * balance IS this sum, nothing else (no separate mutable balance column). */
export async function sumLedgerAmount(tx: Tx, schoolId: string, financialAccountId: string) {
  const result = await tx.financialLedger.aggregate({
    where: { schoolId, financialAccountId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

export async function findOpeningBalanceEntry(
  tx: Tx,
  schoolId: string,
  financialAccountId: string,
) {
  return tx.financialLedger.findFirst({
    where: { schoolId, financialAccountId, entryType: "OPENING_BALANCE" },
  });
}

export async function findLedgerEntryForIncome(
  tx: Tx,
  schoolId: string,
  incomeTransactionId: string,
) {
  return tx.financialLedger.findFirst({
    where: { schoolId, incomeTransactionId, entryType: "INCOME" },
  });
}

export async function findLedgerEntryForExpense(
  tx: Tx,
  schoolId: string,
  expenseTransactionId: string,
) {
  return tx.financialLedger.findFirst({
    where: { schoolId, expenseTransactionId, entryType: "EXPENSE" },
  });
}
