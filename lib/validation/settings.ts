import { z } from "zod";

export const approvalSettingsUpdateSchema = z.object({
  expenseApprovalThreshold: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Threshold harus berupa angka desimal, mis. "1000000.00".')
    .optional(),
  allowNegativeBalance: z.boolean().optional(),
});

export type ApprovalSettingsUpdateInput = z.infer<typeof approvalSettingsUpdateSchema>;
