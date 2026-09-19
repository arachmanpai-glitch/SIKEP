import type { IncomeTransaction } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { Tx } from "@/repositories/LedgerRepository";

export interface CreateIncomeData {
  schoolId: string;
  financialAccountId: string;
  fundSourceId: string;
  categoryId: string;
  amount: string;
  transactionDate: Date;
  description?: string;
  createdById: string;
  postedById: string;
  idempotencyKey?: string;
}

/** Income never goes through an approval gate (spec section 11 only
 * describes approval for expenses) — created and posted in one step. */
export async function createPostedIncome(
  tx: Tx,
  data: CreateIncomeData,
): Promise<IncomeTransaction> {
  return tx.incomeTransaction.create({
    data: { ...data, status: "POSTED", postedAt: new Date() },
  });
}

export async function findIncomeByIdempotencyKey(
  tx: Tx,
  schoolId: string,
  idempotencyKey: string,
): Promise<IncomeTransaction | null> {
  return tx.incomeTransaction.findFirst({ where: { schoolId, idempotencyKey } });
}

export async function listIncome(schoolId: string): Promise<IncomeTransaction[]> {
  return prisma.incomeTransaction.findMany({
    where: { schoolId },
    orderBy: { transactionDate: "desc" },
  });
}

export async function findIncomeById(
  schoolId: string,
  id: string,
): Promise<IncomeTransaction | null> {
  return prisma.incomeTransaction.findFirst({ where: { id, schoolId } });
}

/** Tx-scoped variant — PaymentService.voidPayment reads the linked income
 * transaction inside its own transaction before reversing it. */
export async function findIncomeByIdTx(
  tx: Tx,
  schoolId: string,
  id: string,
): Promise<IncomeTransaction | null> {
  return tx.incomeTransaction.findFirst({ where: { id, schoolId } });
}

export async function markIncomeVoided(
  tx: Tx,
  schoolId: string,
  id: string,
  reason: string,
): Promise<IncomeTransaction> {
  return tx.incomeTransaction.update({
    where: { id, schoolId },
    data: { status: "VOIDED", voidedAt: new Date(), voidReason: reason },
  });
}
