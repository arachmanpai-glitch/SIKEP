import { Prisma, type SantriCredit, type SantriCreditType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { Tx } from "@/repositories/LedgerRepository";

export interface CreateSantriCreditData {
  schoolId: string;
  santriId: string;
  type: SantriCreditType;
  /** Signed: positive for ISSUED, negative for CONSUMED/VOIDED_REVERSAL. */
  amount: Prisma.Decimal | string;
  sourcePaymentId?: string;
  consumedForBillId?: string;
  note?: string;
}

export async function createSantriCredit(
  tx: Tx,
  data: CreateSantriCreditData,
): Promise<SantriCredit> {
  return tx.santriCredit.create({ data });
}

/** Available credit = SUM of every signed row for the santri — append-only
 * ledger, same philosophy as financial_ledger (D32/Phase 2 schema comment). */
export async function sumSantriCreditBalance(
  tx: Tx,
  schoolId: string,
  santriId: string,
): Promise<Prisma.Decimal> {
  const result = await tx.santriCredit.aggregate({
    where: { schoolId, santriId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

export async function listSantriCredits(
  schoolId: string,
  santriId: string,
): Promise<SantriCredit[]> {
  return prisma.santriCredit.findMany({
    where: { schoolId, santriId },
    orderBy: { createdAt: "desc" },
  });
}

/** How much credit a specific payment originally issued — used by
 * PaymentService.voidPayment to know how much to reverse. */
export async function sumIssuedCreditForPayment(
  tx: Tx,
  schoolId: string,
  sourcePaymentId: string,
): Promise<Prisma.Decimal> {
  const result = await tx.santriCredit.aggregate({
    where: { schoolId, sourcePaymentId, type: "ISSUED" },
    _sum: { amount: true },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}
