import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) },
}));
vi.mock("@/repositories/ApprovalRequestRepository", () => ({
  findApprovalRequestById: vi.fn(),
  listApprovalRequests: vi.fn(),
  markApprovalRequestApproved: vi.fn(),
  markApprovalRequestRejected: vi.fn(),
}));
vi.mock("@/repositories/ExpenseTransactionRepository", () => ({
  findExpenseById: vi.fn(),
  markExpenseRejected: vi.fn(),
}));
vi.mock("@/services/AuditService", () => ({ recordAudit: vi.fn() }));
vi.mock("@/services/ExpenseService", () => ({
  postApprovedExpenseWithinTransaction: vi.fn(),
}));

import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  findApprovalRequestById,
  markApprovalRequestApproved,
  markApprovalRequestRejected,
} from "@/repositories/ApprovalRequestRepository";
import { findExpenseById, markExpenseRejected } from "@/repositories/ExpenseTransactionRepository";
import { recordAudit } from "@/services/AuditService";
import { approveExpense, rejectExpense } from "@/services/ApprovalService";
import { postApprovedExpenseWithinTransaction } from "@/services/ExpenseService";

const APPROVER = {
  userId: "approver-1",
  schoolId: "school-a",
  roleCode: "YAYASAN",
  email: "y@sikep.test",
};

function pendingApproval(overrides: Partial<{ status: string; requestedById: string }> = {}) {
  return {
    id: "appr-1",
    schoolId: "school-a",
    expenseTransactionId: "exp-1",
    status: overrides.status ?? "PENDING",
    requestedById: overrides.requestedById ?? "bendahara-1",
  };
}

function pendingExpense(overrides: Partial<{ status: string }> = {}) {
  return { id: "exp-1", schoolId: "school-a", status: overrides.status ?? "PENDING_APPROVAL" };
}

describe("services/ApprovalService.approveExpense", () => {
  beforeEach(() => {
    vi.mocked(findApprovalRequestById)
      .mockReset()
      .mockResolvedValue(pendingApproval() as never);
    vi.mocked(findExpenseById)
      .mockReset()
      .mockResolvedValue(pendingExpense() as never);
    vi.mocked(postApprovedExpenseWithinTransaction)
      .mockReset()
      .mockResolvedValue({ id: "exp-1", status: "POSTED" } as never);
    vi.mocked(markApprovalRequestApproved)
      .mockReset()
      .mockResolvedValue({ id: "appr-1" } as never);
    vi.mocked(recordAudit).mockReset();
  });

  it("throws NotFoundError for a nonexistent approval request", async () => {
    vi.mocked(findApprovalRequestById).mockResolvedValue(null);
    await expect(approveExpense(APPROVER, "ghost")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ConflictError when the approval request was already decided", async () => {
    vi.mocked(findApprovalRequestById).mockResolvedValue(
      pendingApproval({ status: "APPROVED" }) as never,
    );
    await expect(approveExpense(APPROVER, "appr-1")).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws ForbiddenError when the approver is also the requester (creator != approver)", async () => {
    vi.mocked(findApprovalRequestById).mockResolvedValue(
      pendingApproval({ requestedById: APPROVER.userId }) as never,
    );
    await expect(approveExpense(APPROVER, "appr-1")).rejects.toBeInstanceOf(ForbiddenError);
    expect(postApprovedExpenseWithinTransaction).not.toHaveBeenCalled();
  });

  it("throws ConflictError when the linked expense is no longer PENDING_APPROVAL", async () => {
    vi.mocked(findExpenseById).mockResolvedValue(pendingExpense({ status: "VOIDED" }) as never);
    await expect(approveExpense(APPROVER, "appr-1")).rejects.toBeInstanceOf(ConflictError);
  });

  it("posts the expense and marks the approval request APPROVED", async () => {
    const result = await approveExpense(APPROVER, "appr-1");

    expect(result).toEqual({ id: "exp-1", status: "POSTED" });
    expect(postApprovedExpenseWithinTransaction).toHaveBeenCalledWith(
      {},
      APPROVER,
      pendingExpense(),
    );
    expect(markApprovalRequestApproved).toHaveBeenCalledWith(
      {},
      "school-a",
      "appr-1",
      APPROVER.userId,
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "APPROVE", entityType: "ApprovalRequest" }),
    );
  });

  it("propagates FinancialIntegrityError from the underlying posting (insufficient balance)", async () => {
    const { FinancialIntegrityError } = await import("@/lib/errors");
    vi.mocked(postApprovedExpenseWithinTransaction).mockRejectedValue(
      new FinancialIntegrityError("Saldo kurang"),
    );
    await expect(approveExpense(APPROVER, "appr-1")).rejects.toBeInstanceOf(
      FinancialIntegrityError,
    );
    expect(markApprovalRequestApproved).not.toHaveBeenCalled();
  });
});

describe("services/ApprovalService.rejectExpense", () => {
  beforeEach(() => {
    vi.mocked(findApprovalRequestById)
      .mockReset()
      .mockResolvedValue(pendingApproval() as never);
    vi.mocked(findExpenseById)
      .mockReset()
      .mockResolvedValue(pendingExpense() as never);
    vi.mocked(markExpenseRejected)
      .mockReset()
      .mockResolvedValue({ id: "exp-1", status: "REJECTED" } as never);
    vi.mocked(markApprovalRequestRejected)
      .mockReset()
      .mockResolvedValue({ id: "appr-1" } as never);
    vi.mocked(recordAudit).mockReset();
  });

  it("throws ForbiddenError when the rejecter is also the requester", async () => {
    vi.mocked(findApprovalRequestById).mockResolvedValue(
      pendingApproval({ requestedById: APPROVER.userId }) as never,
    );
    await expect(rejectExpense(APPROVER, "appr-1", "Alasan")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(markExpenseRejected).not.toHaveBeenCalled();
  });

  it("marks the expense REJECTED and records the reason on the approval request", async () => {
    const result = await rejectExpense(APPROVER, "appr-1", "Anggaran tidak sesuai");

    expect(result).toEqual({ id: "exp-1", status: "REJECTED" });
    expect(markApprovalRequestRejected).toHaveBeenCalledWith(
      {},
      "school-a",
      "appr-1",
      APPROVER.userId,
      "Anggaran tidak sesuai",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "REJECT", entityType: "ApprovalRequest" }),
    );
  });
});
