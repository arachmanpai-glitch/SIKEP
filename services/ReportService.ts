import { Prisma, type BillStatus } from "@prisma/client";

import type { SessionPayload } from "@/lib/auth/session";
import {
  type BillingReportFilter,
  type CategoryTotalRow,
  listBillsForReport,
  sumExpenseByCategory,
  sumIncomeByCategory,
} from "@/repositories/ReportRepository";

export interface FinancialReportInput {
  from: Date;
  to: Date;
}

export interface FinancialReport {
  from: Date;
  to: Date;
  income: CategoryTotalRow[];
  expense: CategoryTotalRow[];
  totalIncome: string;
  totalExpense: string;
  net: string;
}

function sumRows(rows: CategoryTotalRow[]): Prisma.Decimal {
  return rows.reduce((sum, r) => sum.plus(r.total), new Prisma.Decimal(0));
}

/** Laporan Keuangan (spec section 6 "Laporan") — POSTED income/expense in
 * `[from, to)`, grouped by category. `to` is exclusive, so callers pass the
 * day AFTER the last day they want included. */
export async function getFinancialReport(
  session: SessionPayload,
  input: FinancialReportInput,
): Promise<FinancialReport> {
  const [income, expense] = await Promise.all([
    sumIncomeByCategory(session.schoolId, input.from, input.to),
    sumExpenseByCategory(session.schoolId, input.from, input.to),
  ]);
  const totalIncome = sumRows(income);
  const totalExpense = sumRows(expense);

  return {
    from: input.from,
    to: input.to,
    income,
    expense,
    totalIncome: totalIncome.toString(),
    totalExpense: totalExpense.toString(),
    net: totalIncome.minus(totalExpense).toString(),
  };
}

export interface BillingReportInput {
  academicYearId?: string;
  classId?: string;
  status?: BillStatus;
}

export interface BillingReportRow {
  billId: string;
  santriName: string;
  santriNis: string;
  className: string | null;
  billType: string;
  amount: string;
  amountPaid: string;
  remaining: string;
  status: BillStatus;
  dueDate: Date | null;
}

export interface BillingReport {
  rows: BillingReportRow[];
  totalAmount: string;
  totalPaid: string;
  totalRemaining: string;
}

/** Laporan Tagihan Santri — one row per santri_bills row matching the
 * filter, with the running amount_paid cache (maintained by
 * services/BillingService.ts) surfaced directly; no separate calculation. */
export async function getBillingReport(
  session: SessionPayload,
  input: BillingReportInput,
): Promise<BillingReport> {
  const filter: BillingReportFilter = {
    academicYearId: input.academicYearId,
    classId: input.classId,
    status: input.status,
  };
  const bills = await listBillsForReport(session.schoolId, filter);

  const rows: BillingReportRow[] = bills.map((bill) => ({
    billId: bill.id,
    santriName: bill.santri.fullName,
    santriNis: bill.santri.nis,
    className: bill.santri.class?.name ?? null,
    billType: bill.billType.name,
    amount: bill.amount.toString(),
    amountPaid: bill.amountPaid.toString(),
    remaining: bill.amount.minus(bill.amountPaid).toString(),
    status: bill.status,
    dueDate: bill.dueDate,
  }));

  const totalAmount = bills.reduce((sum, b) => sum.plus(b.amount), new Prisma.Decimal(0));
  const totalPaid = bills.reduce((sum, b) => sum.plus(b.amountPaid), new Prisma.Decimal(0));

  return {
    rows,
    totalAmount: totalAmount.toString(),
    totalPaid: totalPaid.toString(),
    totalRemaining: totalAmount.minus(totalPaid).toString(),
  };
}
