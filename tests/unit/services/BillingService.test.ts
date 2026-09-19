import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) },
}));
vi.mock("@/repositories/SantriBillRepository", () => ({
  createBill: vi.fn(),
  findBillById: vi.fn(),
  listBillsForSchool: vi.fn(),
}));
vi.mock("@/services/AuditService", () => ({ recordAudit: vi.fn() }));

import { createBill, findBillById } from "@/repositories/SantriBillRepository";
import { recordAudit } from "@/services/AuditService";
import {
  createBillForSantri,
  createBulkBillsForSantri,
  getBillForSchool,
} from "@/services/BillingService";
import { NotFoundError } from "@/lib/errors";

const SESSION = {
  userId: "u1",
  schoolId: "school-a",
  roleCode: "BENDAHARA",
  email: "b@sikep.test",
};

const billInput = {
  santriId: "santri-1",
  billTypeId: "bt-1",
  academicYearId: "ay-1",
  amount: "500000.00",
};

describe("services/BillingService.createBillForSantri", () => {
  beforeEach(() => {
    vi.mocked(createBill)
      .mockReset()
      .mockResolvedValue({ id: "bill-1", ...billInput } as never);
    vi.mocked(recordAudit).mockReset();
  });

  it("creates one bill and audits it as CREATE", async () => {
    const bill = await createBillForSantri(SESSION, billInput);
    expect(bill.id).toBe("bill-1");
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entityType: "SantriBill", entityId: "bill-1" }),
    );
  });
});

describe("services/BillingService.createBulkBillsForSantri", () => {
  beforeEach(() => {
    vi.mocked(createBill).mockReset();
    vi.mocked(recordAudit).mockReset();
  });

  it("creates one bill per santriId and audits each individually", async () => {
    vi.mocked(createBill)
      .mockResolvedValueOnce({ id: "bill-1" } as never)
      .mockResolvedValueOnce({ id: "bill-2" } as never)
      .mockResolvedValueOnce({ id: "bill-3" } as never);

    const bills = await createBulkBillsForSantri(SESSION, {
      santriIds: ["s1", "s2", "s3"],
      billTypeId: "bt-1",
      academicYearId: "ay-1",
      amount: "500000.00",
    });

    expect(bills).toHaveLength(3);
    expect(createBill).toHaveBeenCalledTimes(3);
    expect(recordAudit).toHaveBeenCalledTimes(3);
  });
});

describe("services/BillingService.getBillForSchool", () => {
  it("throws NotFoundError for a nonexistent bill", async () => {
    vi.mocked(findBillById).mockReset().mockResolvedValue(null);
    await expect(getBillForSchool(SESSION, "ghost")).rejects.toBeInstanceOf(NotFoundError);
  });
});
