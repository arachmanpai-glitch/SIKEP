import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/rbac";
import { approvalSettingsUpdateSchema } from "@/lib/validation/settings";
import {
  getApprovalSettingsForSchool,
  updateApprovalSettingsForSchool,
} from "@/services/SettingsService";

export async function GET() {
  try {
    // Readable by any authenticated role (Bendahara needs the threshold to
    // know when a transaction requires approval; Yayasan for monitoring).
    const session = await requireSession();
    const settings = await getApprovalSettingsForSchool(session);
    return apiSuccess(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireRole("ADMIN");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const parsed = approvalSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    const settings = await updateApprovalSettingsForSchool(session, parsed.data);
    return apiSuccess(settings, "Pengaturan approval berhasil diperbarui.");
  } catch (error) {
    return handleApiError(error);
  }
}
