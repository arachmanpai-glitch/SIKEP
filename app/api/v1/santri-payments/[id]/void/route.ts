import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { voidTransactionSchema } from "@/lib/validation/void";
import { voidPayment } from "@/services/PaymentService";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await requireRole("BENDAHARA");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const parsed = voidTransactionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    const payment = await voidPayment(session, id, parsed.data.reason);
    return apiSuccess(payment, "Pembayaran berhasil dibatalkan.");
  } catch (error) {
    return handleApiError(error);
  }
}
