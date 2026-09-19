import type { Prisma, SantriBill } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { Tx } from "@/repositories/LedgerRepository";

export interface CreateBillData {
  schoolId: string;
  santriId: string;
  billTypeId: string;
  academicYearId: string;
  amount: string;
  dueDate?: Date;
  description?: string;
}

export async function createBill(tx: Tx, data: CreateBillData): Promise<SantriBill> {
  return tx.santriBill.create({ data });
}

export async function findBillById(schoolId: string, id: string): Promise<SantriBill | null> {
  return prisma.santriBill.findFirst({ where: { id, schoolId, deletedAt: null } });
}

/** Tx-scoped, no status filter — PaymentService.voidPayment reads the
 * bill's CURRENT state (whatever it is) to reverse one allocation. */
export async function findBillByIdTx(
  tx: Tx,
  schoolId: string,
  id: string,
): Promise<SantriBill | null> {
  return tx.santriBill.findFirst({ where: { id, schoolId } });
}

/** Scoped + excludes VOIDED/soft-deleted — used by PaymentService/CreditService
 * to validate every bill a payment/credit is being allocated against. */
export async function findAllocatableBillsByIds(
  tx: Tx,
  schoolId: string,
  ids: string[],
): Promise<SantriBill[]> {
  return tx.santriBill.findMany({
    where: { id: { in: ids }, schoolId, deletedAt: null, status: { not: "VOIDED" } },
  });
}

export async function listBillsForSchool(
  schoolId: string,
  santriId?: string,
): Promise<SantriBill[]> {
  return prisma.santriBill.findMany({
    where: { schoolId, deletedAt: null, ...(santriId ? { santriId } : {}) },
    orderBy: { dueDate: "asc" },
  });
}

export async function updateBillPayment(
  tx: Tx,
  schoolId: string,
  id: string,
  data: { amountPaid: Prisma.Decimal; status: SantriBill["status"] },
): Promise<SantriBill> {
  return tx.santriBill.update({ where: { id, schoolId }, data });
}
