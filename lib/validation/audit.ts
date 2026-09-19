import { z } from "zod";

/** Mirrors the `AuditAction` enum in prisma/schema.prisma exactly (spec
 * section 16 — fixed list, "do not extend without a spec change"). */
export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "SUBMIT",
  "APPROVE",
  "REJECT",
  "POST",
  "VOID",
  "REVERSAL",
  "LOGIN",
  "LOGOUT",
  "EXPORT",
  "CONFIG_CHANGE",
] as const;

export const auditLogQuerySchema = z.object({
  action: z.enum(AUDIT_ACTIONS).optional(),
  entityType: z.string().trim().min(1).max(100).optional(),
  userId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
