import type { BillStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Read-only aggregate/list queries for `services/ReportService.ts`
 * (Laporan Keuangan / Laporan Tagihan Santri, spec section 6).
 */

export interface CategoryTotalRow {
  categoryId: string;
  categoryName: string;
  total: string;
}

async function sumByCategory(
  schoolId: string,
  type: "INCOME" | "EXPENSE",
  from: Date,
  to: Date,
): Promise<CategoryTotalRow[]> {
  const where = { schoolId, status: "POSTED" as const, transactionDate: { gte: from, lt: to } };
  const grouped =
    type === "INCOME"
      ? await prisma.incomeTransaction.groupBy({
          by: ["categoryId"],
          where,
          _sum: { amount: true },
        })
      : await prisma.expenseTransaction.groupBy({
          by: ["categoryId"],
          where,
          _sum: { amount: true },
        });
  if (grouped.length === 0) return [];

  const categories = await prisma.transactionCategory.findMany({
    where: { id: { in: grouped.map((g) => g.categoryId) } },
  });
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  return grouped.map((g) => ({
    categoryId: g.categoryId,
    categoryName: nameById.get(g.categoryId) ?? "(kategori tidak dikenal)",
    total: (g._sum.amount ?? 0).toString(),
  }));
}

export async function sumIncomeByCategory(schoolId: string, from: Date, to: Date) {
  return sumByCategory(schoolId, "INCOME", from, to);
}

export async function sumExpenseByCategory(schoolId: string, from: Date, to: Date) {
  return sumByCategory(schoolId, "EXPENSE", from, to);
}

export interface BillingReportFilter {
  academicYearId?: string;
  classId?: string;
  status?: BillStatus;
}

export async function listBillsForReport(schoolId: string, filter: BillingReportFilter) {
  return prisma.santriBill.findMany({
    where: {
      schoolId,
      deletedAt: null,
      ...(filter.academicYearId ? { academicYearId: filter.academicYearId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.classId ? { santri: { classId: filter.classId } } : {}),
    },
    include: {
      santri: { include: { class: true } },
      billType: true,
    },
    orderBy: [{ santri: { fullName: "asc" } }, { dueDate: "asc" }],
  });
}
