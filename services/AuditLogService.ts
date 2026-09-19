import type { SessionPayload } from "@/lib/auth/session";
import type { AuditLogQuery } from "@/lib/validation/audit";
import { type AuditLogPage, listAuditLogs } from "@/repositories/AuditLogRepository";

export async function listAuditLogsForSchool(
  session: SessionPayload,
  query: AuditLogQuery,
): Promise<AuditLogPage> {
  return listAuditLogs(
    session.schoolId,
    {
      action: query.action,
      entityType: query.entityType,
      userId: query.userId,
      from: query.from,
      to: query.to,
    },
    query.page,
    query.pageSize,
  );
}
