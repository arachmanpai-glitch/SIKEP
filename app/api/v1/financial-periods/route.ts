import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/rbac";
import { createFinancialPeriodSchema } from "@/lib/validation/financial-period";
import {
  createFinancialPeriod,
  listFinancialPeriodsForSchool,
} from "@/services/FinancialPeriodService";

export async function GET() {
  try {
    // Read access for any authenticated role — Bendahara operates
    // (Kas & Bank / Rekonsiliasi), Yayasan/Admin monitor.
    const session = await requireSession();
    const periods = await listFinancialPeriodsForSchool(session);
    return apiSuccess(periods);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Kas & Bank / Rekonsiliasi is Bendahara's responsibility (spec section 2).
    const session = await requireRole("BENDAHARA");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const parsed = createFinancialPeriodSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    const period = await createFinancialPeriod(session, parsed.data);
    return apiSuccess(period, "Periode keuangan berhasil dibuat.", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
