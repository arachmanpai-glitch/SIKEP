import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/ReportRepository", () => ({
  sumIncomeByCategory: vi.fn(),
  sumExpenseByCategory: vi.fn(),
  listBillsForReport: vi.fn(),
}));

import { Prisma } from "@prisma/client";

import {
  listBillsForReport,
  sumExpenseByCategory,
  sumIncomeByCategory,
} from "@/repositories/ReportRepository";
import { getBillingReport, getFinancialReport } from "@/services/ReportService";

const SESSION = {
  userId: "u1",
  schoolId: "school-a",
  roleCode: "BENDAHARA",
  email: "b@sikep.test",
};

describe("services/ReportService.getFinancialReport", () => {
  beforeEach(() => {
    vi.mocked(sumIncomeByCategory).mockReset();
    vi.mocked(sumExpenseByCategory).mockReset();
  });

  it("computes totals and net from category-grouped rows", async () => {
    vi.mocked(sumIncomeByCategory).mockResolvedValue([
      { categoryId: "c1", categoryName: "Syahriyah", total: "3000000.00" },
      { categoryId: "c2", categoryName: "Donasi", total: "1000000.00" },
    ]);
    vi.mocked(sumExpenseByCategory).mockResolvedValue([
      { categoryId: "c3", categoryName: "ATK", total: "500000.00" },
    ]);

    const from = new Date("2026-01-01T00:00:00Z");
    const to = new Date("2026-02-01T00:00:00Z");
    const report = await getFinancialReport(SESSION, { from, to });

    expect(report.totalIncome).toBe("4000000");
    expect(report.totalExpense).toBe("500000");
    expect(report.net).toBe("3500000");
    expect(sumIncomeByCategory).toHaveBeenCalledWith("school-a", from, to);
  });

  it("returns zero totals when there are no transactions in range", async () => {
    vi.mocked(sumIncomeByCategory).mockResolvedValue([]);
    vi.mocked(sumExpenseByCategory).mockResolvedValue([]);

    const report = await getFinancialReport(SESSION, {
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-02-01T00:00:00Z"),
    });

    expect(report.totalIncome).toBe("0");
    expect(report.totalExpense).toBe("0");
    expect(report.net).toBe("0");
  });
});

describe("services/ReportService.getBillingReport", () => {
  beforeEach(() => {
    vi.mocked(listBillsForReport).mockReset();
  });

  it("shapes each bill row with santri/class/billType names and remaining amount", async () => {
    vi.mocked(listBillsForReport).mockResolvedValue([
      {
        id: "bill-1",
        amount: new Prisma.Decimal("500000"),
        amountPaid: new Prisma.Decimal("300000"),
        status: "PARTIAL",
        dueDate: null,
        santri: { fullName: "Budi", nis: "001", class: { name: "K3" } },
        billType: { name: "Syahriyah" },
      } as never,
    ]);

    const report = await getBillingReport(SESSION, {});

    expect(report.rows).toEqual([
      expect.objectContaining({
        billId: "bill-1",
        santriName: "Budi",
        santriNis: "001",
        className: "K3",
        billType: "Syahriyah",
        amount: "500000",
        amountPaid: "300000",
        remaining: "200000",
        status: "PARTIAL",
      }),
    ]);
  });

  it("passes filters straight through to the repository", async () => {
    vi.mocked(listBillsForReport).mockResolvedValue([]);

    await getBillingReport(SESSION, {
      academicYearId: "ay-1",
      classId: "class-1",
      status: "UNPAID",
    });

    expect(listBillsForReport).toHaveBeenCalledWith("school-a", {
      academicYearId: "ay-1",
      classId: "class-1",
      status: "UNPAID",
    });
  });
});
