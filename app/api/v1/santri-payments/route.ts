import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/rbac";
import { recordPaymentSchema } from "@/lib/validation/payment";
import { listPaymentsForSession, recordPayment } from "@/services/PaymentService";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const santriId = request.nextUrl.searchParams.get("santriId") ?? undefined;
    const payments = await listPaymentsForSession(session, santriId);
    return apiSuccess(payments);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("BENDAHARA");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const parsed = recordPaymentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;
    const { payment, replayed } = await recordPayment(session, parsed.data, idempotencyKey);

    return apiSuccess(
      payment,
      replayed
        ? "Pembayaran sudah pernah dicatat (idempotent replay)."
        : "Pembayaran berhasil dicatat.",
      replayed ? 200 : 201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
