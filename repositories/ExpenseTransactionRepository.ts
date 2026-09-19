import type { ExpenseTransaction } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { Tx } from "@/repositories/LedgerRepository";

export interface CreateExpenseData {
  schoolId: string;
  financialAccountId: string;
  categoryId: string;
  amount: string;
  transactionDate: Date;
  description?: string;
  createdById: string;
  idempotencyKey?: string;
  requiresApproval: boolean;
  approvalThresholdSnapshot: string | null;
}

/** Posted immediately — used when the amount is under threshold and the
 * category doesn't require approval (spec section 11). */
export async function createPostedExpense(
  tx: Tx,
  data: CreateExpenseData & { postedById: string },
): Promise<ExpenseTransaction> {
  return tx.expenseTransaction.create({
    data: { ...data, status: "POSTED", postedAt: new Date() },
  });
}

/** Parked pending approval (PHASE 7 owns the approve/reject actions that
 * move this to POSTED or back to DRAFT) — does NOT touch the ledger. */
export async function createPendingApprovalExpense(
  tx: Tx,
  data: CreateExpenseData,
): Promise<ExpenseTransaction> {
  return tx.expenseTransaction.create({
    data: { ...data, status: "PENDING_APPROVAL" },
  });
}

export async function findExpenseByIdempotencyKey(
  tx: Tx,
  schoolId: string,
  idempotencyKey: string,
): Promise<ExpenseTransaction | null> {
  return tx.expenseTransaction.findFirst({ where: { schoolId, idempotencyKey } });
}

export async function listExpenses(schoolId: string): Promise<ExpenseTransaction[]> {
  return prisma.expenseTransaction.findMany({
    where: { schoolId },
    orderBy: { transactionDate: "desc" },
  });
}

export async function findExpenseById(
  schoolId: string,
  id: string,
): Promise<ExpenseTransaction | null> {
  return prisma.expenseTransaction.findFirst({ where: { id, schoolId } });
}

export async function markExpenseVoided(
  tx: Tx,
  schoolId: string,
  id: string,
  reason: string,
): Promise<ExpenseTransaction> {
  return tx.expenseTransaction.update({
    where: { id, schoolId },
    data: { status: "VOIDED", voidedAt: new Date(), voidReason: reason },
  });
}

/**
 * PHASE 7: moves an expense out of PENDING_APPROVAL once its
 * approval_requests row is decided. The `status: "PENDING_APPROVAL"` in
 * the WHERE clause is a concurrency guard — if two approvers race to
 * decide the same expense, the second update matches zero rows (Prisma
 * throws P2025) instead of silently double-posting it.
 */
export async function markExpensePosted(
  tx: Tx,
  schoolId: string,
  id: string,
  postedById: string,
): Promise<ExpenseTransaction> {
  return tx.expenseTransaction.update({
    where: { id, schoolId, status: "PENDING_APPROVAL" },
    data: { status: "POSTED", postedAt: new Date(), postedById },
  });
}

export async function markExpenseRejected(
  tx: Tx,
  schoolId: string,
  id: string,
): Promise<ExpenseTransaction> {
  return tx.expenseTransaction.update({
    where: { id, schoolId, status: "PENDING_APPROVAL" },
    data: { status: "REJECTED" },
  });
}
