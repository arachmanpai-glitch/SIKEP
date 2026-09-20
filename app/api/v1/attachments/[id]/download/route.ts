import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";
import { requireSession } from "@/lib/rbac";
import { downloadAttachment } from "@/services/AttachmentService";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** ASCII-safe fallback plus an RFC 5987 `filename*` for non-ASCII names —
 * never interpolate the raw filename into the header (CRLF/quote
 * injection). */
function contentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Still requires a valid session on top of the signed token (docs/decisions.md
 * D75) — lib/rbac.ts's core rule ("every route re-checks its own
 * authorization") applies here too, this is not a bare-bearer presigned
 * link. Records the EXPORT audit write itself (see D50 for the same
 * GET-with-audit-write pattern). */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await requireSession();

    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");
    const expires = Number(searchParams.get("expires"));
    if (!token || !Number.isFinite(expires)) {
      throw new ValidationError("Tautan unduhan tidak lengkap.");
    }

    const file = await downloadAttachment(session, id, token, expires);

    return new NextResponse(new Uint8Array(file.data), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": contentDisposition(file.fileName),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
