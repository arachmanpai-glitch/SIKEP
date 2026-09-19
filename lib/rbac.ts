import { getSessionTokenFromCookies } from "@/lib/auth/cookies";
import { type SessionPayload, verifySessionToken } from "@/lib/auth/session";
import { type RoleCode } from "@/constants/roles";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

/**
 * Server-side session + RBAC helpers. Node runtime only (reads the
 * HttpOnly cookie via next/headers) — for the Edge-runtime equivalent used
 * by middleware.ts, see lib/auth/session.ts directly.
 *
 * IMPORTANT: middleware.ts is a coarse, UX-level gate (redirect to
 * /login), NOT the authorization boundary. Every API route / server
 * action MUST call requireSession()/requireRole() itself — relying solely
 * on middleware for authorization is a known bypass class in Next.js
 * (route handlers can be reached in ways middleware doesn't always cover).
 * See docs/architecture.md "Keamanan".
 */

export async function getSession(): Promise<SessionPayload | null> {
  const token = await getSessionTokenFromCookies();
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

export async function requireRole(...allowedRoles: RoleCode[]): Promise<SessionPayload> {
  const session = await requireSession();
  if (!allowedRoles.includes(session.roleCode as RoleCode)) {
    throw new ForbiddenError();
  }
  return session;
}

/**
 * Tenant isolation guard (spec section 14 / IDOR protection, section 15).
 * Call this whenever a route/service loads a resource by id, comparing
 * the resource's own `school_id` against the session's — never trust a
 * `schoolId` supplied by the client.
 */
export function requireSameSchool(session: SessionPayload, resourceSchoolId: string): void {
  if (session.schoolId !== resourceSchoolId) {
    throw new ForbiddenError("Anda tidak memiliki akses ke data sekolah lain.");
  }
}
