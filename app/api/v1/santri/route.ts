import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/rbac";
import { santriCreateSchema } from "@/lib/validation/santri";
import { santriService } from "@/services/SantriService";

export async function GET() {
  try {
    const session = await requireSession();
    const records = await santriService.list(session);
    return apiSuccess(records);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("ADMIN");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const parsed = santriCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    const record = await santriService.create(session, parsed.data);
    return apiSuccess(record, "Santri berhasil ditambahkan.", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
