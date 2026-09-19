import { Prisma, type SantriPayment } from "@prisma/client";

import type { SessionPayload } from "@/lib/auth/session";
import { computeBillStatus } from "@/lib/bill-status";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { withIdempotency } from "@/lib/idempotency";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { RecordPaymentInput } from "@/lib/validation/payment";
import {
  createAllocation,
  listAllocationsForPaymentTx,
} from "@/repositories/PaymentAllocationRepository";
import {
  findActiveFinancialAccount,
  findActiveFundSource,
  findActiveIncomeCategory,
} from "@/repositories/FinancialLookupRepository";
import {
  findIncomeByIdempotencyKey,
  findIncomeByIdTx,
} from "@/repositories/IncomeTransactionRepository";
import {
  createSantriCredit,
  sumIssuedCreditForPayment,
  sumSantriCreditBalance,
} from "@/repositories/SantriCreditRepository";
import { findActiveSantri } from "@/repositories/SantriRepository";
import {
  findAllocatableBillsByIds,
  findBillByIdTx,
  updateBillPayment,
} from "@/repositories/SantriBillRepository";
import {
  createSantriPayment,
  findSantriPaymentByIncomeTransactionId,
  findSantriPaymentById,
  listSantriPayments,
  markSantriPaymentVoided,
} from "@/repositories/SantriPaymentRepository";
import { recordAudit } from "@/services/AuditService";
import { postIncomeWithinTransaction, voidIncomeWithinTransaction } from "@/services/IncomeService";

const log = logger.child({ module: "PaymentService" });

export interface RecordPaymentResult {
  payment: SantriPayment;
  replayed: boolean;
}

/**
 * spec section 12: full/partial payment, multiple bills in one payment,
 * overpayment -> credit. A payment is always income (money coming in), so
 * this composes IncomeService's posting primitive
 * (`postIncomeWithinTransaction`) inside its OWN transaction — one atomic
 * unit: post the income + ledger effect, create the santri_payments row,
 * allocate across the requested bills (oldest due date first), and issue
 * santri_credits for any amount left over.
 */
export async function recordPayment(
  session: SessionPayload,
  input: RecordPaymentInput,
  idempotencyKey: string | undefined,
): Promise<RecordPaymentResult> {
  const { record: payment, replayed } = await prisma.$transaction(async (tx) => {
    return withIdempotency({
      findExisting: async () => {
        if (!idempotencyKey) return null;
        const income = await findIncomeByIdempotencyKey(tx, session.schoolId, idempotencyKey);
        if (!income) return null;
        return findSantriPaymentByIncomeTransactionId(tx, session.schoolId, income.id);
      },
      create: async () => {
        const santri = await findActiveSantri(tx, session.schoolId, input.santriId);
        if (!santri) throw new NotFoundError("Santri");

        const account = await findActiveFinancialAccount(
          tx,
          session.schoolId,
          input.financialAccountId,
        );
        if (!account) throw new NotFoundError("Akun Keuangan");

        const fundSource = await findActiveFundSource(tx, session.schoolId, input.fundSourceId);
        if (!fundSource) throw new NotFoundError("Sumber Dana");

        const category = await findActiveIncomeCategory(tx, session.schoolId, input.categoryId);
        if (!category) throw new NotFoundError("Kategori Transaksi (tipe pemasukan)");

        let remaining = new Prisma.Decimal(input.amount);
        const allocations: {
          billId: string;
          amount: Prisma.Decimal;
          billAmount: Prisma.Decimal;
          billAmountPaid: Prisma.Decimal;
        }[] = [];

        if (input.billIds.length > 0) {
          const bills = await findAllocatableBillsByIds(tx, session.schoolId, input.billIds);
          if (bills.length !== input.billIds.length) {
            throw new NotFoundError(
              "Tagihan Santri (sebagian ID tidak ditemukan atau sudah VOIDED)",
            );
          }
          const foreignBill = bills.find((bill) => bill.santriId !== input.santriId);
          if (foreignBill) {
            throw new ValidationError("Semua tagihan yang dipilih harus milik santri yang sama.");
          }

          // Oldest due date first — bills without a due date go last.
          const sorted = [...bills].sort((a, b) => {
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.getTime() - b.dueDate.getTime();
          });

          for (const bill of sorted) {
            if (remaining.lte(0)) break;
            const billRemaining = bill.amount.minus(bill.amountPaid);
            if (billRemaining.lte(0)) continue;
            const alloc = Prisma.Decimal.min(remaining, billRemaining);
            allocations.push({
              billId: bill.id,
              amount: alloc,
              billAmount: bill.amount,
              billAmountPaid: bill.amountPaid,
            });
            remaining = remaining.minus(alloc);
          }
        }

        const income = await postIncomeWithinTransaction(tx, {
          schoolId: session.schoolId,
          financialAccountId: input.financialAccountId,
          fundSourceId: input.fundSourceId,
          categoryId: input.categoryId,
          amount: input.amount,
          transactionDate: input.paymentDate,
          description: input.note ?? "Pembayaran santri",
          createdById: session.userId,
          postedById: session.userId,
          idempotencyKey,
        });

        const created = await createSantriPayment(tx, {
          schoolId: session.schoolId,
          santriId: input.santriId,
          financialAccountId: input.financialAccountId,
          incomeTransactionId: income.id,
          amount: input.amount,
          paymentDate: input.paymentDate,
          referenceNo: input.referenceNo,
          note: input.note,
        });

        for (const alloc of allocations) {
          await createAllocation(tx, {
            schoolId: session.schoolId,
            santriPaymentId: created.id,
            santriBillId: alloc.billId,
            amount: alloc.amount.toString(),
          });
          const newAmountPaid = alloc.billAmountPaid.plus(alloc.amount);
          await updateBillPayment(tx, session.schoolId, alloc.billId, {
            amountPaid: newAmountPaid,
            status: computeBillStatus(alloc.billAmount, newAmountPaid),
          });
        }

        if (remaining.gt(0)) {
          await createSantriCredit(tx, {
            schoolId: session.schoolId,
            santriId: input.santriId,
            type: "ISSUED",
            amount: remaining,
            sourcePaymentId: created.id,
            note: input.billIds.length > 0 ? "Kelebihan bayar" : "Deposit di muka",
          });
        }

        await recordAudit({
          schoolId: session.schoolId,
          userId: session.userId,
          action: "CREATE",
          entityType: "SantriPayment",
          entityId: created.id,
          newValues: created,
        });

        log.info(
          { paymentId: created.id, santriId: input.santriId, amount: input.amount },
          "Santri payment recorded",
        );
        return created;
      },
    });
  });

  return { payment, replayed };
}

export async function listPaymentsForSession(
  session: SessionPayload,
  santriId?: string,
): Promise<SantriPayment[]> {
  return listSantriPayments(session.schoolId, santriId);
}

/**
 * Voids a payment: reverses its bill allocations (decrements
 * amount_paid/recomputes status), reverses the linked income transaction
 * (reuses `voidIncomeWithinTransaction`), and reverses any credit this
 * payment issued — but ONLY if that credit hasn't already been spent.
 * santri_credits is a fungible pool, not lot-tracked back to a specific
 * payment, so once the santri's overall balance drops below what this
 * payment issued, there is no way to know for certain "this payment's"
 * credit specifically was the part spent — refusing is the financially
 * safe choice (see docs/decisions.md PHASE 6 notes).
 */
export async function voidPayment(
  session: SessionPayload,
  id: string,
  reason: string,
): Promise<SantriPayment> {
  const existing = await findSantriPaymentById(session.schoolId, id);
  if (!existing) throw new NotFoundError("Pembayaran Santri");
  if (existing.status !== "POSTED") {
    throw new ForbiddenError("Hanya pembayaran berstatus POSTED yang dapat dibatalkan.");
  }

  return prisma.$transaction(async (tx) => {
    const allocations = await listAllocationsForPaymentTx(tx, session.schoolId, id);

    for (const allocation of allocations) {
      const bill = await findBillByIdTx(tx, session.schoolId, allocation.santriBillId);
      if (!bill) continue;
      const newAmountPaid = bill.amountPaid.minus(allocation.amount);
      await updateBillPayment(tx, session.schoolId, bill.id, {
        amountPaid: newAmountPaid,
        status: computeBillStatus(bill.amount, newAmountPaid),
      });
    }

    const issuedAmount = await sumIssuedCreditForPayment(tx, session.schoolId, id);
    if (issuedAmount.gt(0)) {
      const currentBalance = await sumSantriCreditBalance(tx, session.schoolId, existing.santriId);
      if (currentBalance.lt(issuedAmount)) {
        throw new ForbiddenError(
          "Tidak dapat membatalkan: sebagian kredit dari pembayaran ini sudah terpakai untuk tagihan lain.",
        );
      }
      await createSantriCredit(tx, {
        schoolId: session.schoolId,
        santriId: existing.santriId,
        type: "VOIDED_REVERSAL",
        amount: issuedAmount.negated(),
        sourcePaymentId: id,
        note: `Pembatalan kredit dari pembayaran yang dibatalkan: ${reason}`,
      });
    }

    if (existing.incomeTransactionId) {
      const income = await findIncomeByIdTx(tx, session.schoolId, existing.incomeTransactionId);
      if (income && income.status === "POSTED") {
        await voidIncomeWithinTransaction(tx, session, income, reason);
      }
    }

    const voided = await markSantriPaymentVoided(tx, session.schoolId, id, reason);

    await recordAudit({
      schoolId: session.schoolId,
      userId: session.userId,
      action: "VOID",
      entityType: "SantriPayment",
      entityId: id,
      oldValues: existing,
      newValues: voided,
    });

    log.info({ paymentId: id, reason }, "Santri payment voided");
    return voided;
  });
}
