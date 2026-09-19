import { Prisma, type FinancialPeriod } from "@prisma/client";

import type { SessionPayload } from "@/lib/auth/session";
import {
  ConflictError,
  FinancialIntegrityError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  type CreatePeriodData,
  createPeriod,
  findClosedPeriodCoveringDate,
  findOverlappingPeriod,
  findPeriodById,
  listPeriods,
  markPeriodClosed,
} from "@/repositories/FinancialPeriodRepository";
import { listActiveFinancialAccounts } from "@/repositories/DashboardRepository";
import type { Tx } from "@/repositories/LedgerRepository";
import type {
  CloseFinancialPeriodInput,
  CreateFinancialPeriodInput,
} from "@/lib/validation/financial-period";
import { recordAudit } from "@/services/AuditService";
import { getAccountBalanceWithRetry } from "@/services/LedgerService";

const log = logger.child({ module: "FinancialPeriodService" });

/**
 * Blocks a NEW income/expense from being posted (or even submitted for
 * approval) with a `transactionDate` that falls inside an already-CLOSED
 * period — the actual financial-integrity purpose of "closing the books"
 * (D57). Deliberately NOT called from void/reversal paths: a correction to
 * an old transaction is recorded as a new REVERSAL entry dated today, which
 * belongs to the CURRENT open period, not the closed one being corrected —
 * standard accounting practice, not an oversight.
 *
 * Called from `services/IncomeService.ts` (`postIncomeWithinTransaction` —
 * covers both direct income recording AND `PaymentService`'s santri
 * payments, which compose the same primitive) and
 * `services/ExpenseService.ts` (`submitAndPost` and `submitForApproval` —
 * both entry points that assign a `transactionDate`).
 */
export async function assertPeriodOpenForDate(tx: Tx, schoolId: string, date: Date): Promise<void> {
  const closedPeriod = await findClosedPeriodCoveringDate(tx, schoolId, date);
  if (closedPeriod) {
    throw new FinancialIntegrityError(
      `Tanggal transaksi berada dalam periode keuangan "${closedPeriod.name}" yang sudah ditutup (rekonsiliasi selesai). Gunakan tanggal di periode yang masih terbuka.`,
    );
  }
}

export async function listFinancialPeriodsForSchool(
  session: SessionPayload,
): Promise<FinancialPeriod[]> {
  return listPeriods(session.schoolId);
}

export async function createFinancialPeriod(
  session: SessionPayload,
  input: CreateFinancialPeriodInput,
): Promise<FinancialPeriod> {
  const overlapping = await findOverlappingPeriod(session.schoolId, input.startDate, input.endDate);
  if (overlapping) {
    throw new ConflictError(
      `Rentang tanggal bertabrakan dengan periode "${overlapping.name}" yang sudah ada.`,
    );
  }

  const data: CreatePeriodData = {
    schoolId: session.schoolId,
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    academicYearId: input.academicYearId,
  };
  const created = await createPeriod(data);

  await recordAudit({
    schoolId: session.schoolId,
    userId: session.userId,
    action: "CREATE",
    entityType: "FinancialPeriod",
    entityId: created.id,
    newValues: created,
  });

  log.info({ periodId: created.id, name: created.name }, "Financial period created");
  return created;
}

export interface ReconciliationRow {
  financialAccountId: string;
  financialAccountName: string;
  systemBalance: string;
  actualBalance: string;
  difference: string;
}

export interface CloseFinancialPeriodResult {
  period: FinancialPeriod;
  reconciliation: ReconciliationRow[];
}

/**
 * Closing is one-directional in V1 (no reopen) — mirrors the transaction-
 * immutability philosophy (spec section 10) extended to periods: a mistake
 * discovered after closing is corrected with a REVERSAL on the specific
 * transaction (which lands in the current open period), not by reopening
 * an entire closed period (D56).
 */
export async function closeFinancialPeriod(
  session: SessionPayload,
  periodId: string,
  input: CloseFinancialPeriodInput,
): Promise<CloseFinancialPeriodResult> {
  const period = await findPeriodById(session.schoolId, periodId);
  if (!period) throw new NotFoundError("Periode Keuangan");
  if (period.status !== "OPEN") {
    throw new ConflictError("Periode ini sudah ditutup sebelumnya.");
  }

  const activeAccounts = await listActiveFinancialAccounts(session.schoolId);
  const activeIds = new Set(activeAccounts.map((a) => a.id));
  const inputIds = new Set(input.balances.map((b) => b.financialAccountId));

  const missing = activeAccounts.filter((a) => !inputIds.has(a.id));
  if (missing.length > 0) {
    throw new ValidationError(
      `Saldo aktual belum diisi untuk akun: ${missing.map((a) => a.name).join(", ")}.`,
    );
  }
  const unknown = input.balances.filter((b) => !activeIds.has(b.financialAccountId));
  if (unknown.length > 0) {
    throw new NotFoundError("Akun Keuangan");
  }

  const reconciliation: ReconciliationRow[] = [];
  for (const balance of input.balances) {
    const account = activeAccounts.find((a) => a.id === balance.financialAccountId);
    if (!account) continue; // unreachable — validated above
    const systemBalance = await getAccountBalanceWithRetry(session.schoolId, account.id);
    const actualBalance = new Prisma.Decimal(balance.actualBalance);
    reconciliation.push({
      financialAccountId: account.id,
      financialAccountName: account.name,
      systemBalance: systemBalance.toString(),
      actualBalance: actualBalance.toString(),
      difference: actualBalance.minus(systemBalance).toString(),
    });
  }

  let updated: FinancialPeriod;
  try {
    updated = await markPeriodClosed(session.schoolId, periodId, session.userId);
  } catch {
    // WHERE status: "OPEN" guard tripped — another close won the race (D48-style guard).
    throw new ConflictError("Periode ini baru saja ditutup oleh pengguna lain.");
  }

  await recordAudit({
    schoolId: session.schoolId,
    userId: session.userId,
    action: "CONFIG_CHANGE",
    entityType: "FinancialPeriod",
    entityId: periodId,
    oldValues: { status: "OPEN" },
    newValues: { status: "CLOSED", reconciliation },
  });

  log.info({ periodId, reconciliation }, "Financial period closed with reconciliation snapshot");
  return { period: updated, reconciliation };
}
