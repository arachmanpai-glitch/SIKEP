import { z } from "zod";

import { ROLE_CODES } from "@/constants/roles";

export const userCreateSchema = z.object({
  fullName: z.string().trim().min(1, "Nama wajib diisi.").max(150),
  email: z.string().trim().toLowerCase().email("Email tidak valid."),
  password: z.string().min(8, "Password minimal 8 karakter."),
  roleCode: z.enum(ROLE_CODES),
  isActive: z.boolean().optional(),
});

export const userUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(150).optional(),
  roleCode: z.enum(ROLE_CODES).optional(),
  isActive: z.boolean().optional(),
  /** Optional — only present when an Admin resets this user's password. */
  password: z.string().min(8, "Password minimal 8 karakter.").optional(),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
