import type { PaymentAllocation } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { Tx } from "@/repositories/LedgerRepository";

export interface CreateAllocationData {
  schoolId: string;
  santriPaymentId: string;
  santriBillId: string;
  amount: string;
}

export async function createAllocation(
  tx: Tx,
  data: CreateAllocationData,
): Promise<PaymentAllocation> {
  return tx.paymentAllocation.create({ data });
}

export async function listAllocationsForPayment(
  schoolId: string,
  santriPaymentId: string,
): Promise<PaymentAllocation[]> {
  return prisma.paymentAllocation.findMany({ where: { schoolId, santriPaymentId } });
}

/** Tx-scoped variant for PaymentService.voidPayment — reads the
 * allocations it needs to reverse inside its own transaction. */
export async function listAllocationsForPaymentTx(
  tx: Tx,
  schoolId: string,
  santriPaymentId: string,
): Promise<PaymentAllocation[]> {
  return tx.paymentAllocation.findMany({ where: { schoolId, santriPaymentId } });
}
