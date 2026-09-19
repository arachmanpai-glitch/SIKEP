import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { applyCreditSchema } from "@/lib/validation/credit";
import { applyCreditToBill } from "@/services/CreditService";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("BENDAHARA");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const parsed = applyCreditSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    const bill = await applyCreditToBill(session, parsed.data);
    return apiSuccess(bill, "Kredit berhasil dipakai untuk tagihan.");
  } catch (error) {
    return handleApiError(error);
  }
}
