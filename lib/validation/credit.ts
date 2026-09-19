import { z } from "zod";

const moneyString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Jumlah harus berupa angka desimal, mis. "500000.00".')
  .refine((v) => Number(v) > 0, "Jumlah harus lebih besar dari 0.");

export const applyCreditSchema = z.object({
  santriId: z.string().uuid("ID santri tidak valid."),
  billId: z.string().uuid("ID tagihan tidak valid."),
  amount: moneyString,
});
export type ApplyCreditInput = z.infer<typeof applyCreditSchema>;
