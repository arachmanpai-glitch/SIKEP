import { z } from "zod";

/** spec section 11: "Rejection wajib memiliki alasan." */
export const rejectApprovalSchema = z.object({
  reason: z.string().trim().min(1, "Alasan penolakan wajib diisi.").max(500),
});
export type RejectApprovalInput = z.infer<typeof rejectApprovalSchema>;
