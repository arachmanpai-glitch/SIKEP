import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/rbac";
import { createAttachmentDownloadUrl } from "@/services/AttachmentService";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Issues a short-lived signed URL (docs/decisions.md D75) — pure
 * computation, no write, so this stays a plain session-gated GET like
 * every other read route (no CSRF needed). */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await requireSession();

    const result = await createAttachmentDownloadUrl(session, id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
