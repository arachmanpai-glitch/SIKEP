import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { closeFinancialPeriodSchema } from "@/lib/validation/financial-period";
import { closeFinancialPeriod } from "@/services/FinancialPeriodService";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await requireRole("BENDAHARA");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const parsed = closeFinancialPeriodSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    const result = await closeFinancialPeriod(session, id, parsed.data);
    return apiSuccess(result, "Periode keuangan berhasil ditutup.");
  } catch (error) {
    return handleApiError(error);
  }
}
