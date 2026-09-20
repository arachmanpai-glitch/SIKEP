import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/rbac";
import {
  listAttachmentsQuerySchema,
  uploadAttachmentMetaSchema,
} from "@/lib/validation/attachment";
import { listAttachments, uploadAttachment } from "@/services/AttachmentService";

export async function GET(request: NextRequest) {
  try {
    // Read access for any authenticated role, same as income/expense GET
    // (Yayasan reviews evidence, Admin oversees).
    const session = await requireSession();
    const params = request.nextUrl.searchParams;

    const parsed = listAttachmentsQuerySchema.safeParse({
      entityType: params.get("entityType") ?? undefined,
      entityId: params.get("entityId") ?? undefined,
    });
    if (!parsed.success) {
      throw new ValidationError("Filter lampiran tidak valid.", parsed.error.flatten());
    }

    const records = await listAttachments(session, parsed.data.entityType, parsed.data.entityId);
    return apiSuccess(records);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Uploading evidence is Bendahara's responsibility, same as recording
    // the underlying transaction (spec section 2).
    const session = await requireRole("BENDAHARA");
    await requireCsrf(request);

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      throw new ValidationError("Request harus berupa multipart/form-data.");
    }

    const parsedMeta = uploadAttachmentMetaSchema.safeParse({
      entityType: formData.get("entityType"),
      entityId: formData.get("entityId"),
    });
    if (!parsedMeta.success) {
      throw new ValidationError("Input tidak valid.", parsedMeta.error.flatten());
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("File wajib diunggah.");
    }

    const data = Buffer.from(await file.arrayBuffer());
    const created = await uploadAttachment(session, {
      entityType: parsedMeta.data.entityType,
      entityId: parsedMeta.data.entityId,
      fileName: file.name || "berkas",
      mimeType: file.type || "application/octet-stream",
      data,
    });

    return apiSuccess(created, "Lampiran berhasil diunggah.", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
