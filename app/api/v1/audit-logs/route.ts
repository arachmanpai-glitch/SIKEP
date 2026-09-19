import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { auditLogQuerySchema } from "@/lib/validation/audit";
import { listAuditLogsForSchool } from "@/services/AuditLogService";

export async function GET(request: NextRequest) {
  try {
    // spec section 2: Admin manages "audit", Yayasan has explicit "audit
    // view" — Bendahara's list doesn't mention audit, so it's excluded.
    const session = await requireRole("ADMIN", "YAYASAN");

    const params = request.nextUrl.searchParams;
    const parsed = auditLogQuerySchema.safeParse({
      action: params.get("action") ?? undefined,
      entityType: params.get("entityType") ?? undefined,
      userId: params.get("userId") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      page: params.get("page") ?? undefined,
      pageSize: params.get("pageSize") ?? undefined,
    });
    if (!parsed.success) {
      throw new ValidationError("Filter audit log tidak valid.", parsed.error.flatten());
    }

    const page = await listAuditLogsForSchool(session, parsed.data);
    return apiSuccess(page);
  } catch (error) {
    return handleApiError(error);
  }
}
