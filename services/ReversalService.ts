import type { FinancialEntityType, FinancialLedger } from "@prisma/client";

import { createLedgerEntry, type Tx } from "@/repositories/LedgerRepository";

export interface ReverseLedgerEntryParams {
  tx: Tx;
  schoolId: string;
  reversedById: string;
  reason: string;
  originalEntityType: Extract<FinancialEntityType, "INCOME_TRANSACTION" | "EXPENSE_TRANSACTION">;
  originalEntityId: string;
  /** The POSTED ledger entry being reversed — caller already fetched it
   * (the lookup differs: incomeTransactionId vs expenseTransactionId). */
  originalLedgerEntry: FinancialLedger;
}

/**
 * The POSTED -> VOIDED -> REVERSAL mechanics shared by IncomeService and
 * ExpenseService's void flows (spec section 10): posts an offsetting
 * REVERSAL ledger entry (opposite sign of the original — this is what
 * actually restores the account balance) and records the formal
 * `reversal_transactions` row linking to it. Does NOT touch the source
 * transaction's own status/voidedAt — that update uses a different
 * repository per entity type, so callers do it themselves alongside this.
 */
export async function reverseLedgerEntry(
  params: ReverseLedgerEntryParams,
): Promise<{ reversalEntry: FinancialLedger }> {
  const reversalEntry = await createLedgerEntry(params.tx, {
    schoolId: params.schoolId,
    financialAccountId: params.originalLedgerEntry.financialAccountId,
    entryType: "REVERSAL",
    amount: params.originalLedgerEntry.amount.negated(),
    referenceType: params.originalEntityType,
    referenceId: params.originalEntityId,
    incomeTransactionId:
      params.originalEntityType === "INCOME_TRANSACTION" ? params.originalEntityId : undefined,
    expenseTransactionId:
      params.originalEntityType === "EXPENSE_TRANSACTION" ? params.originalEntityId : undefined,
    description: `Reversal: ${params.reason}`,
  });

  await params.tx.reversalTransaction.create({
    data: {
      schoolId: params.schoolId,
      originalEntityType: params.originalEntityType,
      originalEntityId: params.originalEntityId,
      reason: params.reason,
      reversedById: params.reversedById,
      ledgerEntryId: reversalEntry.id,
    },
  });

  return { reversalEntry };
}
