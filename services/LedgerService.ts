import { Prisma } from "@prisma/client";

import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { withSerializableRetry } from "@/lib/serializable-retry";
import {
  createLedgerEntry,
  findOpeningBalanceEntry,
  sumLedgerAmount,
  type Tx,
} from "@/repositories/LedgerRepository";

/**
 * Core ledger mechanics (spec section 8). ENDING BALANCE = SUM of every
 * financial_ledger row for the account — full stop. There is no separate
 * mutable "current balance" column anywhere; `financial_accounts.
 * opening_balance` (set once at account creation, PHASE 4) is folded into
 * the ledger itself as an OPENING_BALANCE entry the first time it's
 * needed (self-healing for accounts created before this phase existed),
 * so a single SUM always tells the whole story.
 *
 * Every exported function here takes `tx` (a Prisma transaction client)
 * and must be called from inside the caller's own `prisma.$transaction`
 * — never given the top-level `prisma` singleton. This is what makes
 * "create the income/expense row" and "post its ledger effect" atomic.
 */

export async function ensureOpeningBalanceEntry(
  tx: Tx,
  schoolId: string,
  financialAccountId: string,
): Promise<void> {
  const existing = await findOpeningBalanceEntry(tx, schoolId, financialAccountId);
  if (existing) return;

  const account = await tx.financialAccount.findFirst({
    where: { id: financialAccountId, schoolId },
  });
  if (!account) {
    throw new NotFoundError("Akun Keuangan");
  }
  if (account.openingBalance.isZero()) return;

  await createLedgerEntry(tx, {
    schoolId,
    financialAccountId,
    entryType: "OPENING_BALANCE",
    amount: account.openingBalance,
    referenceType: "OPENING_BALANCE",
    referenceId: financialAccountId,
    description: "Saldo awal akun.",
  });
}

export async function getAccountBalance(
  tx: Tx,
  schoolId: string,
  financialAccountId: string,
): Promise<Prisma.Decimal> {
  await ensureOpeningBalanceEntry(tx, schoolId, financialAccountId);
  return sumLedgerAmount(tx, schoolId, financialAccountId);
}

/**
 * Read-path convenience wrapper around `getAccountBalance` for callers that
 * don't already have their own `tx` open (dashboard/report/reconciliation
 * reads, PHASE 8/9) — opens its own Serializable transaction + retry, the
 * exact same mechanism PHASE 5's posting paths use. Centralized here so
 * every caller shares one wrapping implementation instead of each
 * reimplementing the retry/isolation boilerplate (see docs/decisions.md
 * D49).
 */
export async function getAccountBalanceWithRetry(
  schoolId: string,
  financialAccountId: string,
): Promise<Prisma.Decimal> {
  return withSerializableRetry(() =>
    prisma.$transaction((tx) => getAccountBalance(tx, schoolId, financialAccountId), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }),
  );
}

export { createLedgerEntry } from "@/repositories/LedgerRepository";
export type { Tx } from "@/repositories/LedgerRepository";
