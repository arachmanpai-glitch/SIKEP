import type { AuditAction, Prisma } from "@prisma/client";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const log = logger.child({ module: "AuditService" });

export interface RecordAuditInput {
  schoolId: string;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Writes one row to `audit_logs` (spec section 16 — immutable, INSERT-only;
 * this is the only writer). Failures are logged but never thrown: an audit
 * write failing must not roll back or block the business mutation it is
 * recording — losing an audit trail entry is bad, silently corrupting a
 * financial transaction because logging failed would be worse.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        schoolId: input.schoolId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        oldValues: (input.oldValues ?? undefined) as Prisma.InputJsonValue | undefined,
        newValues: (input.newValues ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    log.error(
      { err: error, entityType: input.entityType, action: input.action },
      "Failed to record audit log",
    );
  }
}
