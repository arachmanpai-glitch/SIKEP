import { z } from "zod";

const moneyString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Jumlah harus berupa angka desimal, mis. "500000.00".')
  .refine((v) => Number(v) > 0, "Jumlah harus lebih besar dari 0.");

export const createBillSchema = z.object({
  santriId: z.string().uuid("ID santri tidak valid."),
  billTypeId: z.string().uuid("ID jenis tagihan tidak valid."),
  academicYearId: z.string().uuid("ID tahun ajaran tidak valid."),
  amount: moneyString,
  dueDate: z.coerce.date().optional(),
  description: z.string().trim().max(500).optional(),
});
export type CreateBillInput = z.infer<typeof createBillSchema>;

export const createBulkBillsSchema = z.object({
  santriIds: z.array(z.string().uuid("ID santri tidak valid.")).min(1, "Pilih minimal 1 santri."),
  billTypeId: z.string().uuid("ID jenis tagihan tidak valid."),
  academicYearId: z.string().uuid("ID tahun ajaran tidak valid."),
  amount: moneyString,
  dueDate: z.coerce.date().optional(),
  description: z.string().trim().max(500).optional(),
});
export type CreateBulkBillsInput = z.infer<typeof createBulkBillsSchema>;
