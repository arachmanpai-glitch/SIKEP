import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/rbac";
import { listApprovalRequestsForSchool } from "@/services/ApprovalService";

const VALID_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED"]);

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const statusParam = request.nextUrl.searchParams.get("status");
    const status =
      statusParam && VALID_STATUSES.has(statusParam)
        ? (statusParam as "PENDING" | "APPROVED" | "REJECTED")
        : undefined;
    const requests = await listApprovalRequestsForSchool(session, status);
    return apiSuccess(requests);
  } catch (error) {
    return handleApiError(error);
  }
}
