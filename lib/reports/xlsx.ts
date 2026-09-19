import ExcelJS from "exceljs";

import type { BillingReport, FinancialReport } from "@/services/ReportService";

/** Server-side XLSX generation (spec section 7 "XLSX") using exceljs.
 * Returns a Buffer — never writes to disk. */

export async function renderFinancialReportXlsx(report: FinancialReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const incomeSheet = workbook.addWorksheet("Pemasukan");
  incomeSheet.columns = [
    { header: "Kategori", key: "category", width: 40 },
    { header: "Jumlah", key: "amount", width: 20 },
  ];
  report.income.forEach((row) =>
    incomeSheet.addRow({ category: row.categoryName, amount: Number(row.total) }),
  );
  incomeSheet.addRow({ category: "Total Pemasukan", amount: Number(report.totalIncome) });

  const expenseSheet = workbook.addWorksheet("Pengeluaran");
  expenseSheet.columns = [
    { header: "Kategori", key: "category", width: 40 },
    { header: "Jumlah", key: "amount", width: 20 },
  ];
  report.expense.forEach((row) =>
    expenseSheet.addRow({ category: row.categoryName, amount: Number(row.total) }),
  );
  expenseSheet.addRow({ category: "Total Pengeluaran", amount: Number(report.totalExpense) });

  const summarySheet = workbook.addWorksheet("Ringkasan");
  summarySheet.columns = [
    { header: "Keterangan", key: "label", width: 30 },
    { header: "Jumlah", key: "amount", width: 20 },
  ];
  summarySheet.addRow({ label: "Total Pemasukan", amount: Number(report.totalIncome) });
  summarySheet.addRow({ label: "Total Pengeluaran", amount: Number(report.totalExpense) });
  summarySheet.addRow({ label: "Net", amount: Number(report.net) });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function renderBillingReportXlsx(report: BillingReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tagihan Santri");
  sheet.columns = [
    { header: "NIS", key: "nis", width: 15 },
    { header: "Nama Santri", key: "name", width: 30 },
    { header: "Kelas", key: "class", width: 15 },
    { header: "Jenis Tagihan", key: "billType", width: 20 },
    { header: "Jumlah", key: "amount", width: 18 },
    { header: "Dibayar", key: "paid", width: 18 },
    { header: "Sisa", key: "remaining", width: 18 },
    { header: "Status", key: "status", width: 12 },
    { header: "Jatuh Tempo", key: "dueDate", width: 15 },
  ];
  report.rows.forEach((row) =>
    sheet.addRow({
      nis: row.santriNis,
      name: row.santriName,
      class: row.className ?? "-",
      billType: row.billType,
      amount: Number(row.amount),
      paid: Number(row.amountPaid),
      remaining: Number(row.remaining),
      status: row.status,
      dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : "-",
    }),
  );
  sheet.addRow({
    name: "Total",
    amount: Number(report.totalAmount),
    paid: Number(report.totalPaid),
    remaining: Number(report.totalRemaining),
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
