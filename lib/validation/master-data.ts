import { z } from "zod";

const moneyString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Jumlah harus berupa angka desimal, mis. "500000.00".');

const uuid = z.string().uuid("ID tidak valid.");

export const academicYearCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama tahun ajaran wajib diisi.").max(50),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isActive: z.boolean().optional(),
});
export const academicYearUpdateSchema = academicYearCreateSchema.partial();
export type AcademicYearCreateInput = z.infer<typeof academicYearCreateSchema>;
export type AcademicYearUpdateInput = z.infer<typeof academicYearUpdateSchema>;

export const classCreateSchema = z.object({
  academicYearId: uuid,
  level: z.enum(["K1", "K2", "K3", "K4", "K5", "K6", "PENGABDIAN"]),
  name: z.string().trim().min(1, "Nama kelas wajib diisi.").max(100),
});
export const classUpdateSchema = classCreateSchema.partial();
export type ClassCreateInput = z.infer<typeof classCreateSchema>;
export type ClassUpdateInput = z.infer<typeof classUpdateSchema>;

export const financialAccountCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama akun wajib diisi.").max(100),
  type: z.enum(["CASH", "BANK"]),
  openingBalance: moneyString.optional(),
  accountNumber: z.string().trim().max(50).optional(),
  isActive: z.boolean().optional(),
});
export const financialAccountUpdateSchema = financialAccountCreateSchema.partial();
export type FinancialAccountCreateInput = z.infer<typeof financialAccountCreateSchema>;
export type FinancialAccountUpdateInput = z.infer<typeof financialAccountUpdateSchema>;

export const fundSourceCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama sumber dana wajib diisi.").max(100),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});
export const fundSourceUpdateSchema = fundSourceCreateSchema.partial();
export type FundSourceCreateInput = z.infer<typeof fundSourceCreateSchema>;
export type FundSourceUpdateInput = z.infer<typeof fundSourceUpdateSchema>;

export const transactionCategoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi.").max(100),
  type: z.enum(["INCOME", "EXPENSE"]),
  requiresApproval: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export const transactionCategoryUpdateSchema = transactionCategoryCreateSchema.partial();
export type TransactionCategoryCreateInput = z.infer<typeof transactionCategoryCreateSchema>;
export type TransactionCategoryUpdateInput = z.infer<typeof transactionCategoryUpdateSchema>;

export const billTypeCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama jenis tagihan wajib diisi.").max(100),
  isActive: z.boolean().optional(),
});
export const billTypeUpdateSchema = billTypeCreateSchema.partial();
export type BillTypeCreateInput = z.infer<typeof billTypeCreateSchema>;
export type BillTypeUpdateInput = z.infer<typeof billTypeUpdateSchema>;
