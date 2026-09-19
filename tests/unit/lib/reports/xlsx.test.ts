import { describe, expect, it } from "vitest";

import { renderBillingReportXlsx, renderFinancialReportXlsx } from "@/lib/reports/xlsx";
import type { BillingReport, FinancialReport } from "@/services/ReportService";

const financialReport: FinancialReport = {
  from: new Date("2026-01-01T00:00:00Z"),
  to: new Date("2026-02-01T00:00:00Z"),
  income: [{ categoryId: "c1", categoryName: "Syahriyah", total: "3000000" }],
  expense: [{ categoryId: "c2", categoryName: "ATK", total: "500000" }],
  totalIncome: "3000000",
  totalExpense: "500000",
  net: "2500000",
};

const billingReport: BillingReport = {
  rows: [
    {
      billId: "bill-1",
      santriName: "Budi",
      santriNis: "001",
      className: "K3",
      billType: "Syahriyah",
      amount: "500000",
      amountPaid: "300000",
      remaining: "200000",
      status: "PARTIAL",
      dueDate: new Date("2026-01-10T00:00:00Z"),
    },
  ],
  totalAmount: "500000",
  totalPaid: "300000",
  totalRemaining: "200000",
};

// XLSX files are ZIP archives — the ZIP local-file-header magic bytes "PK".
const ZIP_MAGIC = "PK";

describe("lib/reports/xlsx", () => {
  it("renders a financial report as a non-empty XLSX buffer", async () => {
    const buffer = await renderFinancialReportXlsx(financialReport);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 2).toString("latin1")).toBe(ZIP_MAGIC);
  });

  it("renders a billing report as a non-empty XLSX buffer", async () => {
    const buffer = await renderBillingReportXlsx(billingReport);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 2).toString("latin1")).toBe(ZIP_MAGIC);
  });
});
