import { z } from "zod";

const moneyString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Jumlah harus berupa angka desimal, mis. "500000.00".')
  .refine((v) => Number(v) > 0, "Jumlah harus lebih besar dari 0.");

export const recordPaymentSchema = z.object({
  santriId: z.string().uuid("ID santri tidak valid."),
  financialAccountId: z.string().uuid("ID akun keuangan tidak valid."),
  fundSourceId: z.string().uuid("ID sumber dana tidak valid."),
  categoryId: z.string().uuid("ID kategori tidak valid."),
  amount: moneyString,
  paymentDate: z.coerce.date(),
  referenceNo: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
  /** Bills this payment is allocated against, in priority order — any
   * amount left over after all of them are fully paid becomes santri
   * credit (spec section 12: overpayment). Omit/empty to record a pure
   * advance deposit — the whole amount becomes credit immediately. */
  billIds: z.array(z.string().uuid("ID tagihan tidak valid.")).optional().default([]),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
