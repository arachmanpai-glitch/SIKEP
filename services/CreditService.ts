import { Prisma, type SantriBill } from "@prisma/client";

import type { SessionPayload } from "@/lib/auth/session";
import { computeBillStatus } from "@/lib/bill-status";
import { FinancialIntegrityError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { ApplyCreditInput } from "@/lib/validation/credit";
import {
  createSantriCredit,
  listSantriCredits,
  sumSantriCreditBalance,
} from "@/repositories/SantriCreditRepository";
import { findActiveSantri } from "@/repositories/SantriRepository";
import { findAllocatableBillsByIds, updateBillPayment } from "@/repositories/SantriBillRepository";
import { recordAudit } from "@/services/AuditService";

const log = logger.child({ module: "CreditService" });

/**
 * Spends a santri's existing credit balance (issued from a previous
 * overpayment, spec section 12) against one bill. Unlike PaymentService,
 * this does NOT create a santri_payments/financial_ledger effect — the
 * cash was already posted to the ledger when the original overpaying
 * payment was recorded; applying credit is purely an internal
 * reallocation between the santri's own bills (santri_bills.amount_paid +
 * a CONSUMED santri_credits row), never a new financial_accounts movement.
 */
export async function applyCreditToBill(
  session: SessionPayload,
  input: ApplyCreditInput,
): Promise<SantriBill> {
  return prisma.$transaction(async (tx) => {
    const santri = await findActiveSantri(tx, session.schoolId, input.santriId);
    if (!santri) throw new NotFoundError("Santri");

    const bills = await findAllocatableBillsByIds(tx, session.schoolId, [input.billId]);
    const bill = bills[0];
    if (!bill) throw new NotFoundError("Tagihan Santri");
    if (bill.santriId !== input.santriId) {
      throw new ValidationError("Tagihan tidak dimiliki oleh santri ini.");
    }

    const amount = new Prisma.Decimal(input.amount);
    const billRemaining = bill.amount.minus(bill.amountPaid);
    if (amount.gt(billRemaining)) {
      throw new ValidationError(`Jumlah melebihi sisa tagihan (Rp${billRemaining.toFixed(2)}).`);
    }

    const balance = await sumSantriCreditBalance(tx, session.schoolId, input.santriId);
    if (amount.gt(balance)) {
      throw new FinancialIntegrityError(
        `Saldo kredit santri tidak mencukupi (saldo Rp${balance.toFixed(2)}, diminta Rp${amount.toFixed(2)}).`,
      );
    }

    await createSantriCredit(tx, {
      schoolId: session.schoolId,
      santriId: input.santriId,
      type: "CONSUMED",
      amount: amount.negated(),
      consumedForBillId: bill.id,
      note: "Kredit dipakai untuk melunasi tagihan.",
    });

    const newAmountPaid = bill.amountPaid.plus(amount);
    const updated = await updateBillPayment(tx, session.schoolId, bill.id, {
      amountPaid: newAmountPaid,
      status: computeBillStatus(bill.amount, newAmountPaid),
    });

    await recordAudit({
      schoolId: session.schoolId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "SantriBill",
      entityId: bill.id,
      oldValues: bill,
      newValues: updated,
    });

    log.info(
      { santriId: input.santriId, billId: bill.id, amount: input.amount },
      "Credit applied to bill",
    );
    return updated;
  });
}

export async function getCreditBalance(session: SessionPayload, santriId: string) {
  const [balance, history] = await Promise.all([
    sumSantriCreditBalance(prisma, session.schoolId, santriId),
    listSantriCredits(session.schoolId, santriId),
  ]);
  return {
    balance: balance.toFixed(2),
    history,
  };
}
