import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { requireRole } from "@/lib/rbac";
import { approveExpense } from "@/services/ApprovalService";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    // Approval is Yayasan's responsibility (spec section 2).
    const session = await requireRole("YAYASAN");
    await requireCsrf(request);

    const expense = await approveExpense(session, id);
    return apiSuccess(expense, "Pengeluaran disetujui dan berhasil diposting.");
  } catch (error) {
    return handleApiError(error);
  }
}
