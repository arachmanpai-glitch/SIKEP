import { z } from "zod";

const moneyString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Jumlah harus berupa angka desimal, mis. "500000.00".')
  .refine((v) => Number(v) > 0, "Jumlah harus lebih besar dari 0.");

export const recordIncomeSchema = z.object({
  financialAccountId: z.string().uuid("ID akun keuangan tidak valid."),
  fundSourceId: z.string().uuid("ID sumber dana tidak valid."),
  categoryId: z.string().uuid("ID kategori tidak valid."),
  amount: moneyString,
  transactionDate: z.coerce.date(),
  description: z.string().trim().max(500).optional(),
});

export type RecordIncomeInput = z.infer<typeof recordIncomeSchema>;
