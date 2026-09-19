import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) },
}));
vi.mock("@/repositories/FinancialLookupRepository", () => ({
  findActiveFinancialAccount: vi.fn(),
  findActiveFundSource: vi.fn(),
  findActiveIncomeCategory: vi.fn(),
}));
vi.mock("@/repositories/IncomeTransactionRepository", () => ({
  findIncomeByIdempotencyKey: vi.fn(),
  findIncomeByIdTx: vi.fn(),
}));
vi.mock("@/repositories/SantriCreditRepository", () => ({
  createSantriCredit: vi.fn(),
  sumIssuedCreditForPayment: vi.fn(),
  sumSantriCreditBalance: vi.fn(),
}));
vi.mock("@/repositories/SantriRepository", () => ({ findActiveSantri: vi.fn() }));
vi.mock("@/repositories/SantriBillRepository", () => ({
  findAllocatableBillsByIds: vi.fn(),
  findBillByIdTx: vi.fn(),
  updateBillPayment: vi.fn(),
}));
vi.mock("@/repositories/SantriPaymentRepository", () => ({
  createSantriPayment: vi.fn(),
  findSantriPaymentByIncomeTransactionId: vi.fn(),
  findSantriPaymentById: vi.fn(),
  listSantriPayments: vi.fn(),
  markSantriPaymentVoided: vi.fn(),
}));
vi.mock("@/repositories/PaymentAllocationRepository", () => ({
  createAllocation: vi.fn(),
  listAllocationsForPaymentTx: vi.fn(),
}));
vi.mock("@/services/AuditService", () => ({ recordAudit: vi.fn() }));
vi.mock("@/services/IncomeService", () => ({
  postIncomeWithinTransaction: vi.fn(),
  voidIncomeWithinTransaction: vi.fn(),
}));

import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  createAllocation,
  listAllocationsForPaymentTx,
} from "@/repositories/PaymentAllocationRepository";
import {
  findActiveFinancialAccount,
  findActiveFundSource,
  findActiveIncomeCategory,
} from "@/repositories/FinancialLookupRepository";
import {
  findIncomeByIdempotencyKey,
  findIncomeByIdTx,
} from "@/repositories/IncomeTransactionRepository";
import {
  createSantriCredit,
  sumIssuedCreditForPayment,
  sumSantriCreditBalance,
} from "@/repositories/SantriCreditRepository";
import { findActiveSantri } from "@/repositories/SantriRepository";
import {
  findAllocatableBillsByIds,
  findBillByIdTx,
  updateBillPayment,
} from "@/repositories/SantriBillRepository";
import {
  createSantriPayment,
  findSantriPaymentByIncomeTransactionId,
  findSantriPaymentById,
  markSantriPaymentVoided,
} from "@/repositories/SantriPaymentRepository";
import { recordAudit } from "@/services/AuditService";
import { postIncomeWithinTransaction, voidIncomeWithinTransaction } from "@/services/IncomeService";
import { recordPayment, voidPayment } from "@/services/PaymentService";

const SESSION = {
  userId: "u1",
  schoolId: "school-a",
  roleCode: "BENDAHARA",
  email: "b@sikep.test",
};

function bill(
  overrides: Partial<{
    id: string;
    amount: string;
    amountPaid: string;
    santriId: string;
    dueDate: Date | null;
  }> = {},
) {
  return {
    id: overrides.id ?? "bill-1",
    schoolId: "school-a",
    santriId: overrides.santriId ?? "santri-1",
    amount: new Prisma.Decimal(overrides.amount ?? "500000.00"),
    amountPaid: new Prisma.Decimal(overrides.amountPaid ?? "0.00"),
    status: "UNPAID",
    dueDate: overrides.dueDate === undefined ? new Date("2026-09-01") : overrides.dueDate,
  };
}

const basePaymentInput = {
  santriId: "santri-1",
  financialAccountId: "acc-1",
  fundSourceId: "fs-1",
  categoryId: "cat-1",
  amount: "500000.00",
  paymentDate: new Date("2026-09-18"),
  billIds: ["bill-1"],
};

describe("services/PaymentService.recordPayment", () => {
  beforeEach(() => {
    vi.mocked(findActiveSantri)
      .mockReset()
      .mockResolvedValue({ id: "santri-1" } as never);
    vi.mocked(findActiveFinancialAccount)
      .mockReset()
      .mockResolvedValue({ id: "acc-1" } as never);
    vi.mocked(findActiveFundSource)
      .mockReset()
      .mockResolvedValue({ id: "fs-1" } as never);
    vi.mocked(findActiveIncomeCategory)
      .mockReset()
      .mockResolvedValue({ id: "cat-1" } as never);
    vi.mocked(findIncomeByIdempotencyKey).mockReset().mockResolvedValue(null);
    vi.mocked(findAllocatableBillsByIds)
      .mockReset()
      .mockResolvedValue([bill()] as never);
    vi.mocked(postIncomeWithinTransaction)
      .mockReset()
      .mockResolvedValue({ id: "inc-1" } as never);
    vi.mocked(createSantriPayment)
      .mockReset()
      .mockResolvedValue({ id: "pay-1", status: "POSTED" } as never);
    vi.mocked(createAllocation).mockReset();
    vi.mocked(updateBillPayment).mockReset();
    vi.mocked(createSantriCredit).mockReset();
    vi.mocked(recordAudit).mockReset();
  });

  it("throws NotFoundError when the santri doesn't belong to this school", async () => {
    vi.mocked(findActiveSantri).mockResolvedValue(null);
    await expect(recordPayment(SESSION, basePaymentInput, undefined)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("full payment: bill 500k, pay 500k -> bill PAID, no credit issued", async () => {
    await recordPayment(SESSION, { ...basePaymentInput, amount: "500000.00" }, undefined);

    expect(updateBillPayment).toHaveBeenCalledWith(
      {},
      "school-a",
      "bill-1",
      expect.objectContaining({ status: "PAID" }),
    );
    const call = vi.mocked(updateBillPayment).mock.calls[0][3];
    expect((call.amountPaid as Prisma.Decimal).toString()).toBe("500000");
    expect(createSantriCredit).not.toHaveBeenCalled();
  });

  it("partial payment: bill 500k, pay 300k -> bill PARTIAL, amountPaid 300k", async () => {
    await recordPayment(SESSION, { ...basePaymentInput, amount: "300000.00" }, undefined);

    const call = vi.mocked(updateBillPayment).mock.calls[0][3];
    expect(call.status).toBe("PARTIAL");
    expect((call.amountPaid as Prisma.Decimal).toString()).toBe("300000");
    expect(createSantriCredit).not.toHaveBeenCalled();
  });

  it("overpayment: bill 500k, pay 600k -> allocated 500k to the bill, 100k issued as credit", async () => {
    await recordPayment(SESSION, { ...basePaymentInput, amount: "600000.00" }, undefined);

    const allocCall = vi.mocked(updateBillPayment).mock.calls[0][3];
    expect((allocCall.amountPaid as Prisma.Decimal).toString()).toBe("500000");
    expect(allocCall.status).toBe("PAID");

    expect(createSantriCredit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ type: "ISSUED", santriId: "santri-1", sourcePaymentId: "pay-1" }),
    );
    const creditCall = vi.mocked(createSantriCredit).mock.calls[0][1];
    expect((creditCall.amount as Prisma.Decimal).toString()).toBe("100000");
  });

  it("splits one payment across multiple bills, oldest due date first", async () => {
    vi.mocked(findAllocatableBillsByIds).mockResolvedValue([
      bill({ id: "bill-late", amount: "300000.00", dueDate: new Date("2026-10-01") }),
      bill({ id: "bill-early", amount: "300000.00", dueDate: new Date("2026-08-01") }),
    ] as never);

    await recordPayment(
      SESSION,
      { ...basePaymentInput, amount: "400000.00", billIds: ["bill-late", "bill-early"] },
      undefined,
    );

    // bill-early (due first) should be paid off completely (300000), then
    // the remaining 100000 allocated to bill-late.
    expect(updateBillPayment).toHaveBeenCalledTimes(2);
    const firstCall = vi.mocked(updateBillPayment).mock.calls[0];
    expect(firstCall[2]).toBe("bill-early");
    expect((firstCall[3].amountPaid as Prisma.Decimal).toString()).toBe("300000");
    const secondCall = vi.mocked(updateBillPayment).mock.calls[1];
    expect(secondCall[2]).toBe("bill-late");
    expect((secondCall[3].amountPaid as Prisma.Decimal).toString()).toBe("100000");
    expect(createSantriCredit).not.toHaveBeenCalled();
  });

  it("records a pure advance deposit (no billIds) entirely as credit", async () => {
    await recordPayment(
      SESSION,
      { ...basePaymentInput, billIds: [], amount: "500000.00" },
      undefined,
    );

    expect(findAllocatableBillsByIds).not.toHaveBeenCalled();
    expect(updateBillPayment).not.toHaveBeenCalled();
    expect(createSantriCredit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ type: "ISSUED", note: "Deposit di muka" }),
    );
  });

  it("throws ValidationError if a requested bill belongs to a different santri", async () => {
    vi.mocked(findAllocatableBillsByIds).mockResolvedValue([
      bill({ santriId: "someone-else" }),
    ] as never);
    await expect(recordPayment(SESSION, basePaymentInput, undefined)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("throws NotFoundError if some requested bill ids don't resolve", async () => {
    vi.mocked(findAllocatableBillsByIds).mockResolvedValue([]);
    await expect(recordPayment(SESSION, basePaymentInput, undefined)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("replays an existing payment for a reused Idempotency-Key", async () => {
    vi.mocked(findIncomeByIdempotencyKey).mockResolvedValue({ id: "inc-existing" } as never);
    vi.mocked(findSantriPaymentByIncomeTransactionId).mockResolvedValue({
      id: "pay-existing",
    } as never);

    const result = await recordPayment(SESSION, basePaymentInput, "key-1");

    expect(result).toEqual({ payment: { id: "pay-existing" }, replayed: true });
    expect(postIncomeWithinTransaction).not.toHaveBeenCalled();
    expect(createSantriPayment).not.toHaveBeenCalled();
  });
});

describe("services/PaymentService.voidPayment", () => {
  beforeEach(() => {
    vi.mocked(findSantriPaymentById).mockReset();
    vi.mocked(listAllocationsForPaymentTx).mockReset().mockResolvedValue([]);
    vi.mocked(findBillByIdTx).mockReset();
    vi.mocked(updateBillPayment).mockReset();
    vi.mocked(sumIssuedCreditForPayment).mockReset().mockResolvedValue(new Prisma.Decimal(0));
    vi.mocked(sumSantriCreditBalance).mockReset();
    vi.mocked(createSantriCredit).mockReset();
    vi.mocked(findIncomeByIdTx).mockReset().mockResolvedValue(null);
    vi.mocked(voidIncomeWithinTransaction).mockReset();
    vi.mocked(markSantriPaymentVoided).mockReset();
    vi.mocked(recordAudit).mockReset();
  });

  it("throws NotFoundError for a nonexistent payment", async () => {
    vi.mocked(findSantriPaymentById).mockResolvedValue(null);
    await expect(voidPayment(SESSION, "ghost", "alasan")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses to void a payment that isn't POSTED", async () => {
    vi.mocked(findSantriPaymentById).mockResolvedValue({ id: "pay-1", status: "VOIDED" } as never);
    await expect(voidPayment(SESSION, "pay-1", "alasan")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("reverses bill allocations and the linked income for a POSTED payment", async () => {
    vi.mocked(findSantriPaymentById).mockResolvedValue({
      id: "pay-1",
      status: "POSTED",
      santriId: "santri-1",
      incomeTransactionId: "inc-1",
    } as never);
    vi.mocked(listAllocationsForPaymentTx).mockResolvedValue([
      { santriBillId: "bill-1", amount: new Prisma.Decimal("300000.00") },
    ] as never);
    vi.mocked(findBillByIdTx).mockResolvedValue(
      bill({ id: "bill-1", amount: "500000.00", amountPaid: "300000.00" }) as never,
    );
    vi.mocked(findIncomeByIdTx).mockResolvedValue({ id: "inc-1", status: "POSTED" } as never);
    vi.mocked(markSantriPaymentVoided).mockResolvedValue({
      id: "pay-1",
      status: "VOIDED",
    } as never);

    const result = await voidPayment(SESSION, "pay-1", "Salah input");

    expect(result).toEqual({ id: "pay-1", status: "VOIDED" });
    const billCall = vi.mocked(updateBillPayment).mock.calls[0];
    expect((billCall[3].amountPaid as Prisma.Decimal).toString()).toBe("0");
    expect(billCall[3].status).toBe("UNPAID");
    expect(voidIncomeWithinTransaction).toHaveBeenCalledWith(
      {},
      SESSION,
      { id: "inc-1", status: "POSTED" },
      "Salah input",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "VOID", entityType: "SantriPayment" }),
    );
  });

  it("refuses to void when the credit it issued has already been partly spent", async () => {
    vi.mocked(findSantriPaymentById).mockResolvedValue({
      id: "pay-1",
      status: "POSTED",
      santriId: "santri-1",
      incomeTransactionId: "inc-1",
    } as never);
    vi.mocked(sumIssuedCreditForPayment).mockResolvedValue(new Prisma.Decimal("100000.00"));
    vi.mocked(sumSantriCreditBalance).mockResolvedValue(new Prisma.Decimal("20000.00")); // already spent most of it

    await expect(voidPayment(SESSION, "pay-1", "Salah input")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(markSantriPaymentVoided).not.toHaveBeenCalled();
  });

  it("reverses unspent issued credit when voiding", async () => {
    vi.mocked(findSantriPaymentById).mockResolvedValue({
      id: "pay-1",
      status: "POSTED",
      santriId: "santri-1",
      incomeTransactionId: null,
    } as never);
    vi.mocked(sumIssuedCreditForPayment).mockResolvedValue(new Prisma.Decimal("100000.00"));
    vi.mocked(sumSantriCreditBalance).mockResolvedValue(new Prisma.Decimal("100000.00")); // untouched
    vi.mocked(markSantriPaymentVoided).mockResolvedValue({
      id: "pay-1",
      status: "VOIDED",
    } as never);

    await voidPayment(SESSION, "pay-1", "Salah input");

    expect(createSantriCredit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ type: "VOIDED_REVERSAL", santriId: "santri-1" }),
    );
    const call = vi.mocked(createSantriCredit).mock.calls[0][1];
    expect((call.amount as Prisma.Decimal).toString()).toBe("-100000");
  });
});
