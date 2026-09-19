import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { isMasterDataEntitySlug, masterDataRegistry } from "@/lib/master-data/registry";
import { requireRole } from "@/lib/rbac";

interface RouteParams {
  params: Promise<{ entity: string; id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { entity, id } = await params;
    if (!isMasterDataEntitySlug(entity)) {
      throw new ValidationError(`Entitas master data "${entity}" tidak dikenal.`);
    }
    const session = await requireRole("ADMIN");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const registryEntry = masterDataRegistry[entity];
    const parsed = registryEntry.updateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    // See app/api/v1/master-data/[entity]/route.ts for why this cast is safe.
    const record = await registryEntry.service.update(session, id, parsed.data as never);
    return apiSuccess(record, `${registryEntry.label} berhasil diperbarui.`);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { entity, id } = await params;
    if (!isMasterDataEntitySlug(entity)) {
      throw new ValidationError(`Entitas master data "${entity}" tidak dikenal.`);
    }
    const session = await requireRole("ADMIN");
    await requireCsrf(request);

    const registryEntry = masterDataRegistry[entity];
    const record = await registryEntry.service.remove(session, id);
    return apiSuccess(record, `${registryEntry.label} berhasil dinonaktifkan.`);
  } catch (error) {
    return handleApiError(error);
  }
}
