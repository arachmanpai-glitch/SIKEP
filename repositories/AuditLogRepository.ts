import type { AuditAction, AuditLog, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface AuditLogFilter {
  action?: AuditAction;
  entityType?: string;
  userId?: string;
  from?: Date;
  to?: Date;
}

export interface AuditLogPage {
  rows: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

/** `audit_logs` is insert-only (spec section 16) — this is the only reader,
 * mirroring `services/AuditService.ts` being the only writer. */
export async function listAuditLogs(
  schoolId: string,
  filter: AuditLogFilter,
  page: number,
  pageSize: number,
): Promise<AuditLogPage> {
  const where: Prisma.AuditLogWhereInput = {
    schoolId,
    ...(filter.action ? { action: filter.action } : {}),
    ...(filter.entityType ? { entityType: filter.entityType } : {}),
    ...(filter.userId ? { userId: filter.userId } : {}),
    ...(filter.from || filter.to
      ? {
          createdAt: {
            ...(filter.from ? { gte: filter.from } : {}),
            ...(filter.to ? { lte: filter.to } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { rows, total, page, pageSize };
}
