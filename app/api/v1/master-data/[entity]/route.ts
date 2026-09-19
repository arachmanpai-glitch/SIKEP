import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { isMasterDataEntitySlug, masterDataRegistry } from "@/lib/master-data/registry";
import { requireRole, requireSession } from "@/lib/rbac";

interface RouteParams {
  params: Promise<{ entity: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { entity } = await params;
    if (!isMasterDataEntitySlug(entity)) {
      throw new ValidationError(`Entitas master data "${entity}" tidak dikenal.`);
    }
    const session = await requireSession();
    const records = await masterDataRegistry[entity].service.list(session);
    return apiSuccess(records);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { entity } = await params;
    if (!isMasterDataEntitySlug(entity)) {
      throw new ValidationError(`Entitas master data "${entity}" tidak dikenal.`);
    }
    // Master data management is Admin-only (spec section 3).
    const session = await requireRole("ADMIN");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const registryEntry = masterDataRegistry[entity];
    const parsed = registryEntry.createSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    // `registryEntry` is one specific union member at runtime (guaranteed
    // by the registry's own object-literal construction — each key pairs a
    // matching adapter+schema), but TypeScript can't prove that a `.schema`
    // access and a `.service` access on the same indexed-by-string-union
    // value correlate to the same member ("correlated union access"), so
    // `parsed.data`'s inferred union type isn't assignable without a cast.
    const record = await registryEntry.service.create(session, parsed.data as never);
    return apiSuccess(record, `${registryEntry.label} berhasil dibuat.`, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
