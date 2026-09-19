import { Prisma, type ExpenseTransaction } from "@prisma/client";

import type { SessionPayload } from "@/lib/auth/session";
import { FinancialIntegrityError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { withIdempotency } from "@/lib/idempotency";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { withSerializableRetry } from "@/lib/serializable-retry";
import type { SubmitExpenseInput } from "@/lib/validation/expense";
import { createPendingApprovalRequest } from "@/repositories/ApprovalRequestRepository";
import { getOrCreateApprovalSettings } from "@/repositories/ApprovalSettingsRepository";
import {
  createPendingApprovalExpense,
  createPostedExpense,
  findExpenseByIdempotencyKey,
  findExpenseById,
  listExpenses,
  markExpensePosted,
  markExpenseVoided,
} from "@/repositories/ExpenseTransactionRepository";
import {
  findActiveExpenseCategory,
  findActiveFinancialAccount,
} from "@/repositories/FinancialLookupRepository";
import {
  createLedgerEntry,
  findLedgerEntryForExpense,
  type Tx,
} from "@/repositories/LedgerRepository";
import { recordAudit } from "@/services/AuditService";
import { assertPeriodOpenForDate } from "@/services/FinancialPeriodService";
import { ensureOpeningBalanceEntry, getAccountBalance } from "@/services/LedgerService";
import { reverseLedgerEntry } from "@/services/ReversalService";

const log = logger.child({ module: "ExpenseService" });

export interface SubmitExpenseResult {
  expense: ExpenseTransaction;
  replayed: boolean;
}

/**
 * spec section 11: approval required if `amount >= threshold` OR
 * `category.requires_approval = true`. Read outside any transaction —
 * it's configuration, not something that needs to be consistent with the
 * balance check below (the threshold actually applied is snapshotted onto
 * the expense row regardless, for an accurate audit trail).
 */
async function resolveApprovalRequirement(schoolId: string, categoryId: string, amount: string) {
  const category = await findActiveExpenseCategory(prisma, schoolId, categoryId);
  if (!category) throw new NotFoundError("Kategori Transaksi (tipe pengeluaran)");

  const settings = await getOrCreateApprovalSettings(schoolId);
  const amountDecimal = new Prisma.Decimal(amount);
  const requiresApproval =
    category.requiresApproval || amountDecimal.gte(settings.expenseApprovalThreshold);

  return { requiresApproval, thresholdSnapshot: settings.expenseApprovalThreshold };
}

export async function submitExpense(
  session: SessionPayload,
  input: SubmitExpenseInput,
  idempotencyKey: string | undefined,
): Promise<SubmitExpenseResult> {
  const { requiresApproval, thresholdSnapshot } = await resolveApprovalRequirement(
    session.schoolId,
    input.categoryId,
    input.amount,
  );

  if (requiresApproval) {
    const result = await submitForApproval(session, input, idempotencyKey, thresholdSnapshot);
    return result;
  }
  return submitAndPost(session, input, idempotencyKey, thresholdSnapshot);
}

async function submitForApproval(
  session: SessionPayload,
  input: SubmitExpenseInput,
  idempotencyKey: string | undefined,
  thresholdSnapshot: Prisma.Decimal,
): Promise<SubmitExpenseResult> {
  const { record: expense, replayed } = await prisma.$transaction(async (tx) => {
    return withIdempotency({
      findExisting: () =>
        idempotencyKey
          ? findExpenseByIdempotencyKey(tx, session.schoolId, idempotencyKey)
          : Promise.resolve(null),
      create: async () => {
        const account = await findActiveFinancialAccount(
          tx,
          session.schoolId,
          input.financialAccountId,
        );
        if (!account) throw new NotFoundError("Akun Keuangan");

        await assertPeriodOpenForDate(tx, session.schoolId, input.transactionDate);

        const created = await createPendingApprovalExpense(tx, {
          schoolId: session.schoolId,
          financialAccountId: input.financialAccountId,
          categoryId: input.categoryId,
          amount: input.amount,
          transactionDate: input.transactionDate,
          description: input.description,
          createdById: session.userId,
          idempotencyKey,
          requiresApproval: true,
          approvalThresholdSnapshot: thresholdSnapshot.toString(),
        });

        // PHASE 7 owns the actual approve/reject actions that move this
        // request (and the expense's status) forward — this only opens it.
        await createPendingApprovalRequest(tx, {
          schoolId: session.schoolId,
          expenseTransactionId: created.id,
          requestedById: session.userId,
          thresholdAmountSnapshot: thresholdSnapshot,
        });

        await recordAudit({
          schoolId: session.schoolId,
          userId: session.userId,
          action: "SUBMIT",
          entityType: "ExpenseTransaction",
          entityId: created.id,
          newValues: created,
        });

        log.info({ expenseId: created.id }, "Expense submitted for approval");
        return created;
      },
    });
  });

  return { expense, replayed };
}

async function submitAndPost(
  session: SessionPayload,
  input: SubmitExpenseInput,
  idempotencyKey: string | undefined,
  thresholdSnapshot: Prisma.Decimal,
): Promise<SubmitExpenseResult> {
  const { record: expense, replayed } = await withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        return withIdempotency({
          findExisting: () =>
            idempotencyKey
              ? findExpenseByIdempotencyKey(tx, session.schoolId, idempotencyKey)
              : Promise.resolve(null),
          create: async () => {
            const account = await findActiveFinancialAccount(
              tx,
              session.schoolId,
              input.financialAccountId,
            );
            if (!account) throw new NotFoundError("Akun Keuangan");

            await assertPeriodOpenForDate(tx, session.schoolId, input.transactionDate);

            const settings = await getOrCreateApprovalSettings(session.schoolId, tx);
            const balance = await getAccountBalance(tx, session.schoolId, input.financialAccountId);
            const amountDecimal = new Prisma.Decimal(input.amount);
            const projectedBalance = balance.minus(amountDecimal);

            if (projectedBalance.lt(0) && !settings.allowNegativeBalance) {
              throw new FinancialIntegrityError(
                `Saldo akun tidak mencukupi (saldo saat ini Rp${balance.toFixed(2)}, pengeluaran Rp${amountDecimal.toFixed(2)}).`,
              );
            }

            const created = await createPostedExpense(tx, {
              schoolId: session.schoolId,
              financialAccountId: input.financialAccountId,
              categoryId: input.categoryId,
              amount: input.amount,
              transactionDate: input.transactionDate,
              description: input.description,
              createdById: session.userId,
              postedById: session.userId,
              idempotencyKey,
              requiresApproval: false,
              approvalThresholdSnapshot: thresholdSnapshot.toString(),
            });

            await ensureOpeningBalanceEntry(tx, session.schoolId, input.financialAccountId);
            await createLedgerEntry(tx, {
              schoolId: session.schoolId,
              financialAccountId: input.financialAccountId,
              entryType: "EXPENSE",
              amount: amountDecimal.negated(),
              referenceType: "EXPENSE_TRANSACTION",
              referenceId: created.id,
              expenseTransactionId: created.id,
            });

            await recordAudit({
              schoolId: session.schoolId,
              userId: session.userId,
              action: "POST",
              entityType: "ExpenseTransaction",
              entityId: created.id,
              newValues: created,
            });

            log.info({ expenseId: created.id, amount: input.amount }, "Expense posted");
            return created;
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  return { expense, replayed };
}

export async function listExpensesForSchool(
  session: SessionPayload,
): Promise<ExpenseTransaction[]> {
  return listExpenses(session.schoolId);
}

/**
 * PHASE 7: posts a previously PENDING_APPROVAL expense to the ledger once
 * `services/ApprovalService.ts` has decided to approve it — the balance
 * check happens HERE (not at submission time), because a threshold-gated
 * expense never checked the balance when it was first submitted
 * (`submitForApproval` deliberately skips it — see that function's
 * comment). `expense` is the caller's already-fetched, already-validated
 * row (status confirmed PENDING_APPROVAL); this only opens/uses the
 * caller's `tx`, never its own transaction, so ApprovalService can commit
 * the ledger effect and the approval_requests decision atomically together.
 */
export async function postApprovedExpenseWithinTransaction(
  tx: Tx,
  session: SessionPayload,
  expense: ExpenseTransaction,
): Promise<ExpenseTransaction> {
  const settings = await getOrCreateApprovalSettings(session.schoolId, tx);
  const balance = await getAccountBalance(tx, session.schoolId, expense.financialAccountId);
  const projectedBalance = balance.minus(expense.amount);

  if (projectedBalance.lt(0) && !settings.allowNegativeBalance) {
    throw new FinancialIntegrityError(
      `Saldo akun tidak mencukupi (saldo saat ini Rp${balance.toFixed(2)}, pengeluaran Rp${expense.amount.toFixed(2)}).`,
    );
  }

  const updated = await markExpensePosted(tx, session.schoolId, expense.id, session.userId);

  await ensureOpeningBalanceEntry(tx, session.schoolId, expense.financialAccountId);
  await createLedgerEntry(tx, {
    schoolId: session.schoolId,
    financialAccountId: expense.financialAccountId,
    entryType: "EXPENSE",
    amount: expense.amount.negated(),
    referenceType: "EXPENSE_TRANSACTION",
    referenceId: expense.id,
    expenseTransactionId: expense.id,
  });

  await recordAudit({
    schoolId: session.schoolId,
    userId: session.userId,
    action: "POST",
    entityType: "ExpenseTransaction",
    entityId: expense.id,
    oldValues: expense,
    newValues: updated,
  });

  log.info({ expenseId: expense.id, amount: expense.amount.toString() }, "Approved expense posted");
  return updated;
}

export async function voidExpense(
  session: SessionPayload,
  id: string,
  reason: string,
): Promise<ExpenseTransaction> {
  const existing = await findExpenseById(session.schoolId, id);
  if (!existing) throw new NotFoundError("Transaksi Pengeluaran");
  if (existing.status !== "POSTED") {
    throw new ForbiddenError("Hanya transaksi berstatus POSTED yang dapat dibatalkan.");
  }

  const voided = await prisma.$transaction(async (tx) => {
    const updated = await markExpenseVoided(tx, session.schoolId, id, reason);

    const originalEntry = await findLedgerEntryForExpense(tx, session.schoolId, id);
    if (!originalEntry) {
      throw new Error(`Ledger entry pengeluaran ${id} tidak ditemukan saat void.`);
    }

    const { reversalEntry } = await reverseLedgerEntry({
      tx,
      schoolId: session.schoolId,
      reversedById: session.userId,
      reason,
      originalEntityType: "EXPENSE_TRANSACTION",
      originalEntityId: id,
      originalLedgerEntry: originalEntry,
    });

    await recordAudit({
      schoolId: session.schoolId,
      userId: session.userId,
      action: "VOID",
      entityType: "ExpenseTransaction",
      entityId: id,
      oldValues: existing,
      newValues: updated,
    });
    await recordAudit({
      schoolId: session.schoolId,
      userId: session.userId,
      action: "REVERSAL",
      entityType: "ExpenseTransaction",
      entityId: id,
      newValues: reversalEntry,
    });

    return updated;
  });

  log.info({ expenseId: id, reason }, "Expense voided and reversed");
  return voided;
}
