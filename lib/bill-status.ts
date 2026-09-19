import type { Prisma } from "@prisma/client";
import type { BillStatus } from "@prisma/client";

/**
 * Shared by PaymentService (new cash payment) and CreditService (existing
 * credit applied to a bill) — both mutate `santri_bills.amount_paid` and
 * need the exact same PAID/PARTIAL/UNPAID decision (spec section 12).
 */
export function computeBillStatus(amount: Prisma.Decimal, amountPaid: Prisma.Decimal): BillStatus {
  if (amountPaid.gte(amount)) return "PAID";
  if (amountPaid.gt(0)) return "PARTIAL";
  return "UNPAID";
}
