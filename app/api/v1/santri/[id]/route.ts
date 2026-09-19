import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { santriUpdateSchema } from "@/lib/validation/santri";
import { santriService } from "@/services/SantriService";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await requireRole("ADMIN");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const parsed = santriUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    const record = await santriService.update(session, id, parsed.data);
    return apiSuccess(record, "Santri berhasil diperbarui.");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await requireRole("ADMIN");
    await requireCsrf(request);
    const record = await santriService.remove(session, id);
    return apiSuccess(record, "Santri berhasil dinonaktifkan.");
  } catch (error) {
    return handleApiError(error);
  }
}
