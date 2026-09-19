import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) },
}));
vi.mock("@/repositories/SantriCreditRepository", () => ({
  createSantriCredit: vi.fn(),
  listSantriCredits: vi.fn(),
  sumSantriCreditBalance: vi.fn(),
}));
vi.mock("@/repositories/SantriRepository", () => ({ findActiveSantri: vi.fn() }));
vi.mock("@/repositories/SantriBillRepository", () => ({
  findAllocatableBillsByIds: vi.fn(),
  updateBillPayment: vi.fn(),
}));
vi.mock("@/services/AuditService", () => ({ recordAudit: vi.fn() }));

import { FinancialIntegrityError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  createSantriCredit,
  listSantriCredits,
  sumSantriCreditBalance,
} from "@/repositories/SantriCreditRepository";
import { findActiveSantri } from "@/repositories/SantriRepository";
import { findAllocatableBillsByIds, updateBillPayment } from "@/repositories/SantriBillRepository";
import { recordAudit } from "@/services/AuditService";
import { applyCreditToBill, getCreditBalance } from "@/services/CreditService";

const SESSION = {
  userId: "u1",
  schoolId: "school-a",
  roleCode: "BENDAHARA",
  email: "b@sikep.test",
};

function bill(overrides: Partial<{ amount: string; amountPaid: string; santriId: string }> = {}) {
  return {
    id: "bill-1",
    schoolId: "school-a",
    santriId: overrides.santriId ?? "santri-1",
    amount: new Prisma.Decimal(overrides.amount ?? "500000.00"),
    amountPaid: new Prisma.Decimal(overrides.amountPaid ?? "200000.00"),
    status: "PARTIAL",
  };
}

const input = { santriId: "santri-1", billId: "bill-1", amount: "100000.00" };

describe("services/CreditService.applyCreditToBill", () => {
  beforeEach(() => {
    vi.mocked(findActiveSantri)
      .mockReset()
      .mockResolvedValue({ id: "santri-1" } as never);
    vi.mocked(findAllocatableBillsByIds)
      .mockReset()
      .mockResolvedValue([bill()] as never);
    vi.mocked(sumSantriCreditBalance)
      .mockReset()
      .mockResolvedValue(new Prisma.Decimal("500000.00"));
    vi.mocked(createSantriCredit).mockReset();
    vi.mocked(updateBillPayment)
      .mockReset()
      .mockResolvedValue({ id: "bill-1", status: "PAID" } as never);
    vi.mocked(recordAudit).mockReset();
  });

  it("throws NotFoundError when the santri doesn't exist", async () => {
    vi.mocked(findActiveSantri).mockResolvedValue(null);
    await expect(applyCreditToBill(SESSION, input)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when the bill doesn't exist", async () => {
    vi.mocked(findAllocatableBillsByIds).mockResolvedValue([]);
    await expect(applyCreditToBill(SESSION, input)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ValidationError when the bill belongs to a different santri", async () => {
    vi.mocked(findAllocatableBillsByIds).mockResolvedValue([
      bill({ santriId: "someone-else" }),
    ] as never);
    await expect(applyCreditToBill(SESSION, input)).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws ValidationError when the amount exceeds the bill's remaining balance", async () => {
    // bill: amount 500000, amountPaid 200000 -> remaining 300000
    await expect(
      applyCreditToBill(SESSION, { ...input, amount: "400000.00" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws FinancialIntegrityError when the santri's credit balance is insufficient", async () => {
    vi.mocked(sumSantriCreditBalance).mockResolvedValue(new Prisma.Decimal("50000.00"));
    await expect(applyCreditToBill(SESSION, input)).rejects.toBeInstanceOf(FinancialIntegrityError);
  });

  it("consumes credit and updates the bill's amount_paid/status", async () => {
    await applyCreditToBill(SESSION, input);

    expect(createSantriCredit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ type: "CONSUMED", consumedForBillId: "bill-1" }),
    );
    const creditCall = vi.mocked(createSantriCredit).mock.calls[0][1];
    expect((creditCall.amount as Prisma.Decimal).toString()).toBe("-100000");

    const billCall = vi.mocked(updateBillPayment).mock.calls[0];
    expect((billCall[3].amountPaid as Prisma.Decimal).toString()).toBe("300000");
  });
});

describe("services/CreditService.getCreditBalance", () => {
  it("returns the summed balance and full history", async () => {
    vi.mocked(sumSantriCreditBalance)
      .mockReset()
      .mockResolvedValue(new Prisma.Decimal("150000.00"));
    vi.mocked(listSantriCredits)
      .mockReset()
      .mockResolvedValue([{ id: "credit-1" }] as never);

    const result = await getCreditBalance(SESSION, "santri-1");

    expect(result.balance).toBe("150000.00");
    expect(result.history).toEqual([{ id: "credit-1" }]);
  });
});
