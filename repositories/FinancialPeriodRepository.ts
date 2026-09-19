import type { FinancialPeriod } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { Tx } from "@/repositories/LedgerRepository";

export interface CreatePeriodData {
  schoolId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  academicYearId?: string;
}

export async function createPeriod(data: CreatePeriodData): Promise<FinancialPeriod> {
  return prisma.financialPeriod.create({ data });
}

export async function listPeriods(schoolId: string): Promise<FinancialPeriod[]> {
  return prisma.financialPeriod.findMany({
    where: { schoolId },
    orderBy: { startDate: "desc" },
  });
}

export async function findPeriodById(
  schoolId: string,
  id: string,
): Promise<FinancialPeriod | null> {
  return prisma.financialPeriod.findFirst({ where: { id, schoolId } });
}

/** Any period (any name) whose date range overlaps `[startDate, endDate]` —
 * used to reject creating two periods that both claim the same dates. */
export async function findOverlappingPeriod(
  schoolId: string,
  startDate: Date,
  endDate: Date,
): Promise<FinancialPeriod | null> {
  return prisma.financialPeriod.findFirst({
    where: {
      schoolId,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });
}

/** Tx-scoped: is `date` covered by a period that's already CLOSED? Called
 * from the income/expense submission paths (D57) — reads inside the same
 * transaction as the eventual insert so the check and the write see a
 * consistent snapshot. */
export async function findClosedPeriodCoveringDate(
  tx: Tx,
  schoolId: string,
  date: Date,
): Promise<FinancialPeriod | null> {
  return tx.financialPeriod.findFirst({
    where: { schoolId, status: "CLOSED", startDate: { lte: date }, endDate: { gte: date } },
  });
}

/** `status: "OPEN"` in the WHERE clause is the same concurrency guard as
 * PHASE 7's approval decisions (D48) — two concurrent close attempts on the
 * same period: the loser's update matches zero rows (P2025). */
export async function markPeriodClosed(
  schoolId: string,
  id: string,
  closedById: string,
): Promise<FinancialPeriod> {
  return prisma.financialPeriod.update({
    where: { id, schoolId, status: "OPEN" },
    data: { status: "CLOSED", closedAt: new Date(), closedById },
  });
}
