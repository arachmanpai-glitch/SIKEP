import { z } from "zod";

export const santriCreateSchema = z.object({
  nis: z.string().trim().min(1, "NIS wajib diisi.").max(30),
  fullName: z.string().trim().min(1, "Nama santri wajib diisi.").max(150),
  classId: z.string().uuid("ID kelas tidak valid.").optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "GRADUATED", "WITHDRAWN"]).optional(),
  enrolledAt: z.coerce.date().optional(),
});
export const santriUpdateSchema = santriCreateSchema.partial();

export type SantriCreateInput = z.infer<typeof santriCreateSchema>;
export type SantriUpdateInput = z.infer<typeof santriUpdateSchema>;
