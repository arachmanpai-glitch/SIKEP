import type { SantriPayment } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { Tx } from "@/repositories/LedgerRepository";

export interface CreateSantriPaymentData {
  schoolId: string;
  santriId: string;
  financialAccountId: string;
  incomeTransactionId: string;
  amount: string;
  paymentDate: Date;
  referenceNo?: string;
  note?: string;
}

export async function createSantriPayment(
  tx: Tx,
  data: CreateSantriPaymentData,
): Promise<SantriPayment> {
  return tx.santriPayment.create({ data });
}

export async function findSantriPaymentById(
  schoolId: string,
  id: string,
): Promise<SantriPayment | null> {
  return prisma.santriPayment.findFirst({ where: { id, schoolId } });
}

/** Used by PaymentService to resolve an Idempotency-Key replay: the key
 * lives on income_transactions, this maps back to the santri_payments row
 * that references it. */
export async function findSantriPaymentByIncomeTransactionId(
  tx: Tx,
  schoolId: string,
  incomeTransactionId: string,
): Promise<SantriPayment | null> {
  return tx.santriPayment.findFirst({ where: { schoolId, incomeTransactionId } });
}

export async function listSantriPayments(
  schoolId: string,
  santriId?: string,
): Promise<SantriPayment[]> {
  return prisma.santriPayment.findMany({
    where: { schoolId, ...(santriId ? { santriId } : {}) },
    orderBy: { paymentDate: "desc" },
  });
}

export async function markSantriPaymentVoided(
  tx: Tx,
  schoolId: string,
  id: string,
  reason: string,
): Promise<SantriPayment> {
  return tx.santriPayment.update({
    where: { id, schoolId },
    data: { status: "VOIDED", voidedAt: new Date(), voidReason: reason },
  });
}
