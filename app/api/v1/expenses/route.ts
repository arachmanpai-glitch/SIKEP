import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/rbac";
import { submitExpenseSchema } from "@/lib/validation/expense";
import { listExpensesForSchool, submitExpense } from "@/services/ExpenseService";

export async function GET() {
  try {
    const session = await requireSession();
    const records = await listExpensesForSchool(session);
    return apiSuccess(records);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("BENDAHARA");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const parsed = submitExpenseSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;
    const { expense, replayed } = await submitExpense(session, parsed.data, idempotencyKey);

    const message =
      expense.status === "PENDING_APPROVAL"
        ? "Pengeluaran diajukan, menunggu approval."
        : replayed
          ? "Pengeluaran sudah pernah diproses (idempotent replay)."
          : "Pengeluaran berhasil dicatat.";

    return apiSuccess(expense, message, replayed ? 200 : 201);
  } catch (error) {
    return handleApiError(error);
  }
}
