import {
  Prisma,
  type ApprovalRequest,
  type ApprovalRequestStatus,
  type ExpenseTransaction,
} from "@prisma/client";

import type { SessionPayload } from "@/lib/auth/session";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { withSerializableRetry } from "@/lib/serializable-retry";
import {
  findApprovalRequestById,
  listApprovalRequests,
  markApprovalRequestApproved,
  markApprovalRequestRejected,
} from "@/repositories/ApprovalRequestRepository";
import { findExpenseById, markExpenseRejected } from "@/repositories/ExpenseTransactionRepository";
import { recordAudit } from "@/services/AuditService";
import { postApprovedExpenseWithinTransaction } from "@/services/ExpenseService";

const log = logger.child({ module: "ApprovalService" });

export async function listApprovalRequestsForSchool(
  session: SessionPayload,
  status?: ApprovalRequestStatus,
): Promise<ApprovalRequest[]> {
  return listApprovalRequests(session.schoolId, status);
}

async function loadPendingApproval(
  session: SessionPayload,
  approvalRequestId: string,
): Promise<{ approval: ApprovalRequest; expense: ExpenseTransaction }> {
  const approval = await findApprovalRequestById(session.schoolId, approvalRequestId);
  if (!approval) throw new NotFoundError("Approval Request");
  if (approval.status !== "PENDING") {
    throw new ConflictError("Approval request ini sudah diputuskan sebelumnya.");
  }

  // spec section 3/11: "Bendahara tidak boleh menyetujui transaksi yang
  // dibuat sendiri" — applies to both approve and reject (either way,
  // the decider and requester must differ). Also enforced at the DB
  // level as defense-in-depth (approval_requests CHECK constraint, D16);
  // this app-level check exists purely to give a clear message instead
  // of a raw constraint-violation error.
  if (approval.requestedById === session.userId) {
    throw new ForbiddenError(
      "Anda tidak dapat memutuskan approval atas transaksi yang Anda ajukan sendiri.",
    );
  }

  const expense = await findExpenseById(session.schoolId, approval.expenseTransactionId);
  if (!expense) throw new NotFoundError("Transaksi Pengeluaran");
  if (expense.status !== "PENDING_APPROVAL") {
    throw new ConflictError("Transaksi pengeluaran ini tidak lagi menunggu approval.");
  }

  return { approval, expense };
}

/**
 * PENDING_APPROVAL -> POSTED (spec section 11). The balance check that a
 * directly-posted expense does at submission time happens HERE instead,
 * inside the same Serializable transaction as the ledger post — see
 * `ExpenseService.postApprovedExpenseWithinTransaction`.
 */
export async function approveExpense(
  session: SessionPayload,
  approvalRequestId: string,
): Promise<ExpenseTransaction> {
  const { expense } = await loadPendingApproval(session, approvalRequestId);

  const posted = await withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const updatedExpense = await postApprovedExpenseWithinTransaction(tx, session, expense);

        try {
          await markApprovalRequestApproved(
            tx,
            session.schoolId,
            approvalRequestId,
            session.userId,
          );
        } catch {
          // Concurrency guard tripped (another decision landed first,
          // P2025 from the WHERE status: "PENDING" clause) — surface a
          // clear conflict instead of a raw Prisma error.
          throw new ConflictError("Approval request ini baru saja diputuskan oleh pengguna lain.");
        }

        await recordAudit({
          schoolId: session.schoolId,
          userId: session.userId,
          action: "APPROVE",
          entityType: "ApprovalRequest",
          entityId: approvalRequestId,
          newValues: { expenseTransactionId: expense.id, status: "APPROVED" },
        });

        return updatedExpense;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  log.info(
    { approvalRequestId, expenseId: expense.id, approvedBy: session.userId },
    "Expense approved and posted",
  );
  return posted;
}

/**
 * PENDING_APPROVAL -> REJECTED (spec section 11: "Rejection wajib
 * memiliki alasan"). Does not touch the ledger — a PENDING_APPROVAL
 * expense was never posted, so there's nothing to reverse.
 *
 * Scope note (see docs/decisions.md D46): the spec diagram also shows
 * REJECTED -> DRAFT (the creator revising and resubmitting). PHASE 7
 * does not build that — there is no "edit an expense" capability
 * anywhere yet, and building one is scope beyond "APPROVAL". A rejected
 * expense stays REJECTED, its full history intact.
 */
export async function rejectExpense(
  session: SessionPayload,
  approvalRequestId: string,
  reason: string,
): Promise<ExpenseTransaction> {
  const { expense } = await loadPendingApproval(session, approvalRequestId);

  const rejected = await prisma.$transaction(async (tx) => {
    let updatedExpense: ExpenseTransaction;
    try {
      updatedExpense = await markExpenseRejected(tx, session.schoolId, expense.id);
    } catch {
      throw new ConflictError("Transaksi pengeluaran ini baru saja diproses oleh pengguna lain.");
    }

    try {
      await markApprovalRequestRejected(
        tx,
        session.schoolId,
        approvalRequestId,
        session.userId,
        reason,
      );
    } catch {
      throw new ConflictError("Approval request ini baru saja diputuskan oleh pengguna lain.");
    }

    await recordAudit({
      schoolId: session.schoolId,
      userId: session.userId,
      action: "REJECT",
      entityType: "ApprovalRequest",
      entityId: approvalRequestId,
      oldValues: { expenseTransactionId: expense.id, status: expense.status },
      newValues: { expenseTransactionId: expense.id, status: "REJECTED", reason },
    });

    return updatedExpense;
  });

  log.info(
    { approvalRequestId, expenseId: expense.id, rejectedBy: session.userId, reason },
    "Expense rejected",
  );
  return rejected;
}
