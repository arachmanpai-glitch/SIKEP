import { z } from "zod";

export const voidTransactionSchema = z.object({
  reason: z.string().trim().min(1, "Alasan wajib diisi.").max(500),
});

export type VoidTransactionInput = z.infer<typeof voidTransactionSchema>;
