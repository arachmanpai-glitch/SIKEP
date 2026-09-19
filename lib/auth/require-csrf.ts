import type { NextRequest } from "next/server";

import { getCsrfCookieValue } from "@/lib/auth/cookies";
import { CSRF_HEADER_NAME, verifyCsrfToken } from "@/lib/auth/csrf";
import { ForbiddenError } from "@/lib/errors";

/**
 * Double-submit CSRF check (lib/auth/csrf.ts) for every state-changing
 * route (POST/PATCH/DELETE) — GET/list routes never call this. Established
 * in PHASE 3 on /api/v1/auth/logout; every mutating PHASE 4+ endpoint
 * calls this at the top of its handler, right after requireRole/requireSession.
 */
export async function requireCsrf(request: NextRequest): Promise<void> {
  const cookieValue = await getCsrfCookieValue();
  const headerValue = request.headers.get(CSRF_HEADER_NAME) ?? undefined;
  if (!verifyCsrfToken(cookieValue, headerValue)) {
    throw new ForbiddenError("CSRF token tidak valid.");
  }
}
