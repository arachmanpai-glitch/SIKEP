import type { IncomeTransaction } from "@prisma/client";

import type { SessionPayload } from "@/lib/auth/session";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { withIdempotency } from "@/lib/idempotency";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { RecordIncomeInput } from "@/lib/validation/income";
import {
  findActiveFinancialAccount,
  findActiveFundSource,
  findActiveIncomeCategory,
} from "@/repositories/FinancialLookupRepository";
import {
  createPostedIncome,
  findIncomeByIdempotencyKey,
  findIncomeById,
  listIncome,
  markIncomeVoided,
  type CreateIncomeData,
} from "@/repositories/IncomeTransactionRepository";
import {
  createLedgerEntry,
  findLedgerEntryForIncome,
  type Tx,
} from "@/repositories/LedgerRepository";
import { recordAudit } from "@/services/AuditService";
import { assertPeriodOpenForDate } from "@/services/FinancialPeriodService";
import { ensureOpeningBalanceEntry } from "@/services/LedgerService";
import { reverseLedgerEntry } from "@/services/ReversalService";

const log = logger.child({ module: "IncomeService" });

export interface RecordIncomeResult {
  income: IncomeTransaction;
  replayed: boolean;
}

/**
 * Creates + posts one income transaction to the ledger, inside a
 * transaction the CALLER already opened (does not manage its own
 * `$transaction`, does not check idempotency). Exported so
 * `services/PaymentService.ts` (PHASE 6) can post a santri payment's
 * income effect atomically alongside its bill-allocation/credit logic,
 * without duplicating this posting sequence a third time.
 */
export async function postIncomeWithinTransaction(
  tx: Tx,
  data: CreateIncomeData,
): Promise<IncomeTransaction> {
  await assertPeriodOpenForDate(tx, data.schoolId, data.transactionDate);

  const created = await createPostedIncome(tx, data);

  await ensureOpeningBalanceEntry(tx, data.schoolId, data.financialAccountId);
  await createLedgerEntry(tx, {
    schoolId: data.schoolId,
    financialAccountId: data.financialAccountId,
    entryType: "INCOME",
    amount: data.amount,
    referenceType: "INCOME_TRANSACTION",
    referenceId: created.id,
    incomeTransactionId: created.id,
  });

  await recordAudit({
    schoolId: data.schoolId,
    userId: data.postedById,
    action: "POST",
    entityType: "IncomeTransaction",
    entityId: created.id,
    newValues: created,
  });

  log.info({ incomeId: created.id, amount: data.amount }, "Income posted");
  return created;
}

/**
 * Income has no approval gate (spec section 11 only describes it for
 * expenses) — validated, created, and posted to the ledger atomically in
 * one DB transaction. Idempotency-Key (if supplied) makes a retried
 * request return the original result instead of double-posting.
 */
export async function recordIncome(
  session: SessionPayload,
  input: RecordIncomeInput,
  idempotencyKey: string | undefined,
): Promise<RecordIncomeResult> {
  const { record: income, replayed } = await prisma.$transaction(async (tx) => {
    return withIdempotency({
      findExisting: () =>
        idempotencyKey
          ? findIncomeByIdempotencyKey(tx, session.schoolId, idempotencyKey)
          : Promise.resolve(null),
      create: async () => {
        const account = await findActiveFinancialAccount(
          tx,
          session.schoolId,
          input.financialAccountId,
        );
        if (!account) throw new NotFoundError("Akun Keuangan");

        const fundSource = await findActiveFundSource(tx, session.schoolId, input.fundSourceId);
        if (!fundSource) throw new NotFoundError("Sumber Dana");

        const category = await findActiveIncomeCategory(tx, session.schoolId, input.categoryId);
        if (!category) throw new NotFoundError("Kategori Transaksi (tipe pemasukan)");

        return postIncomeWithinTransaction(tx, {
          schoolId: session.schoolId,
          financialAccountId: input.financialAccountId,
          fundSourceId: input.fundSourceId,
          categoryId: input.categoryId,
          amount: input.amount,
          transactionDate: input.transactionDate,
          description: input.description,
          createdById: session.userId,
          postedById: session.userId,
          idempotencyKey,
        });
      },
    });
  });

  return { income, replayed };
}

export async function listIncomeForSchool(session: SessionPayload): Promise<IncomeTransaction[]> {
  return listIncome(session.schoolId);
}

/**
 * Reverses one POSTED income transaction, inside a transaction the
 * CALLER already opened and already validated (existing row fetched,
 * status confirmed POSTED). Exported for `services/PaymentService.ts` to
 * void a santri payment's linked income atomically alongside reversing
 * its bill allocations/credit.
 */
export async function voidIncomeWithinTransaction(
  tx: Tx,
  session: SessionPayload,
  existing: IncomeTransaction,
  reason: string,
): Promise<IncomeTransaction> {
  const updated = await markIncomeVoided(tx, session.schoolId, existing.id, reason);

  const originalEntry = await findLedgerEntryForIncome(tx, session.schoolId, existing.id);
  if (!originalEntry) {
    // Should be unreachable (every POSTED income has exactly one ledger
    // entry) — surfaced loudly rather than silently voiding without a
    // reversal effect, which would corrupt the ledger.
    throw new Error(`Ledger entry pemasukan ${existing.id} tidak ditemukan saat void.`);
  }

  const { reversalEntry } = await reverseLedgerEntry({
    tx,
    schoolId: session.schoolId,
    reversedById: session.userId,
    reason,
    originalEntityType: "INCOME_TRANSACTION",
    originalEntityId: existing.id,
    originalLedgerEntry: originalEntry,
  });

  await recordAudit({
    schoolId: session.schoolId,
    userId: session.userId,
    action: "VOID",
    entityType: "IncomeTransaction",
    entityId: existing.id,
    oldValues: existing,
    newValues: updated,
  });
  await recordAudit({
    schoolId: session.schoolId,
    userId: session.userId,
    action: "REVERSAL",
    entityType: "IncomeTransaction",
    entityId: existing.id,
    newValues: reversalEntry,
  });

  log.info({ incomeId: existing.id, reason }, "Income voided and reversed");
  return updated;
}

export async function voidIncome(
  session: SessionPayload,
  id: string,
  reason: string,
): Promise<IncomeTransaction> {
  const existing = await findIncomeById(session.schoolId, id);
  if (!existing) throw new NotFoundError("Transaksi Pemasukan");
  if (existing.status !== "POSTED") {
    throw new ForbiddenError("Hanya transaksi berstatus POSTED yang dapat dibatalkan.");
  }

  return prisma.$transaction((tx) => voidIncomeWithinTransaction(tx, session, existing, reason));
}
