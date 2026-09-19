import type { ApprovalRequest, ApprovalRequestStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { Tx } from "@/repositories/LedgerRepository";

export interface CreatePendingApprovalRequestData {
  schoolId: string;
  expenseTransactionId: string;
  requestedById: string;
  thresholdAmountSnapshot: Prisma.Decimal;
}

/** Opens the approval workflow for an expense (spec section 11) — PHASE 7
 * owns the approve/reject actions that move it out of PENDING. */
export async function createPendingApprovalRequest(tx: Tx, data: CreatePendingApprovalRequestData) {
  return tx.approvalRequest.create({
    data: {
      schoolId: data.schoolId,
      expenseTransactionId: data.expenseTransactionId,
      status: "PENDING",
      requestedById: data.requestedById,
      thresholdAmountSnapshot: data.thresholdAmountSnapshot,
    },
  });
}

export async function findApprovalRequestById(
  schoolId: string,
  id: string,
): Promise<ApprovalRequest | null> {
  return prisma.approvalRequest.findFirst({ where: { id, schoolId } });
}

export async function listApprovalRequests(
  schoolId: string,
  status?: ApprovalRequestStatus,
): Promise<ApprovalRequest[]> {
  return prisma.approvalRequest.findMany({
    where: { schoolId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * `status: "PENDING"` in the WHERE clause is the same concurrency guard
 * as `ExpenseTransactionRepository.markExpensePosted`/`markExpenseRejected`
 * — if two Yayasan users race to decide the same request, the loser's
 * update matches zero rows (P2025) instead of silently overwriting the
 * winner's decision.
 */
export async function markApprovalRequestApproved(
  tx: Tx,
  schoolId: string,
  id: string,
  decidedById: string,
): Promise<ApprovalRequest> {
  return tx.approvalRequest.update({
    where: { id, schoolId, status: "PENDING" },
    data: { status: "APPROVED", decidedById, decidedAt: new Date() },
  });
}

export async function markApprovalRequestRejected(
  tx: Tx,
  schoolId: string,
  id: string,
  decidedById: string,
  reason: string,
): Promise<ApprovalRequest> {
  return tx.approvalRequest.update({
    where: { id, schoolId, status: "PENDING" },
    data: { status: "REJECTED", decidedById, decidedAt: new Date(), reason },
  });
}
