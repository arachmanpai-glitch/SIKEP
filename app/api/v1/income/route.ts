import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/rbac";
import { recordIncomeSchema } from "@/lib/validation/income";
import { listIncomeForSchool, recordIncome } from "@/services/IncomeService";

export async function GET() {
  try {
    // Read access for any authenticated role (Yayasan monitors, Admin oversees).
    const session = await requireSession();
    const records = await listIncomeForSchool(session);
    return apiSuccess(records);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Recording income is Bendahara's responsibility (spec section 2).
    const session = await requireRole("BENDAHARA");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const parsed = recordIncomeSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;
    const { income, replayed } = await recordIncome(session, parsed.data, idempotencyKey);

    return apiSuccess(
      income,
      replayed
        ? "Pemasukan sudah pernah dicatat (idempotent replay)."
        : "Pemasukan berhasil dicatat.",
      replayed ? 200 : 201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
