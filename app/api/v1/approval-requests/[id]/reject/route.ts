import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { rejectApprovalSchema } from "@/lib/validation/approval";
import { rejectExpense } from "@/services/ApprovalService";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await requireRole("YAYASAN");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const parsed = rejectApprovalSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    const expense = await rejectExpense(session, id, parsed.data.reason);
    return apiSuccess(expense, "Pengeluaran ditolak.");
  } catch (error) {
    return handleApiError(error);
  }
}
