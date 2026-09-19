import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { createBulkBillsSchema } from "@/lib/validation/bill";
import { createBulkBillsForSantri } from "@/services/BillingService";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("BENDAHARA");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const parsed = createBulkBillsSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    const bills = await createBulkBillsForSantri(session, parsed.data);
    return apiSuccess(bills, `${bills.length} tagihan berhasil dibuat.`, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
