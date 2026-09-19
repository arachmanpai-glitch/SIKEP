import { z } from "zod";

/** Actual balance a human counted (cash in hand / bank statement) — unlike
 * transaction amounts (lib/validation/income.ts `moneyString`), this is
 * allowed to be zero or negative (a bank account can be overdrawn). */
const actualBalanceString = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, 'Saldo aktual harus berupa angka desimal, mis. "500000.00".');

export const createFinancialPeriodSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    academicYearId: z.string().uuid().optional(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "Tanggal selesai harus setelah tanggal mulai.",
    path: ["endDate"],
  });

export type CreateFinancialPeriodInput = z.infer<typeof createFinancialPeriodSchema>;

export const closeFinancialPeriodSchema = z.object({
  balances: z
    .array(
      z.object({
        financialAccountId: z.string().uuid("ID akun keuangan tidak valid."),
        actualBalance: actualBalanceString,
      }),
    )
    .min(1, "Saldo aktual minimal 1 akun harus diisi untuk menutup periode."),
});

export type CloseFinancialPeriodInput = z.infer<typeof closeFinancialPeriodSchema>;
