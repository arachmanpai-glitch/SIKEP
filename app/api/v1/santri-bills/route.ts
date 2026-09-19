import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/rbac";
import { createBillSchema } from "@/lib/validation/bill";
import { createBillForSantri, listBillsForSession } from "@/services/BillingService";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const santriId = request.nextUrl.searchParams.get("santriId") ?? undefined;
    const bills = await listBillsForSession(session, santriId);
    return apiSuccess(bills);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Billing is Bendahara's responsibility (spec section 2).
    const session = await requireRole("BENDAHARA");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const parsed = createBillSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    const bill = await createBillForSantri(session, parsed.data);
    return apiSuccess(bill, "Tagihan berhasil dibuat.", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
