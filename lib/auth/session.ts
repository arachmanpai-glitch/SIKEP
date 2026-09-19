import { jwtVerify, SignJWT } from "jose";

import { env } from "@/lib/env";

/**
 * Stateless JWT session (HS256), not a DB-backed session table — there is
 * no `sessions` table in the SIKEP spec's table list (section 13), and a
 * signed, short-lived cookie needs none: every request re-verifies the
 * signature + expiry, no DB round-trip required. Trade-off (documented in
 * docs/decisions.md D18): a role/permission change does not take effect
 * for an already-issued session until it expires or the user logs in
 * again — acceptable given the short expiry below. Runs on the Edge
 * runtime (middleware.ts), so this file must stay free of Node-only APIs
 * (no `@node-rs/argon2`, no Prisma).
 */
export const SESSION_COOKIE_NAME = "sikep_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export interface SessionPayload {
  /** User id (JWT `sub`). */
  userId: string;
  schoolId: string;
  roleCode: string;
  email: string;
}

const secretKey = new TextEncoder().encode(env.AUTH_SECRET);

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    schoolId: payload.schoolId,
    roleCode: payload.roleCode,
    email: payload.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey);
}

/** Returns null on any invalid/expired/tampered token, never throws. */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (
      typeof payload.sub !== "string" ||
      typeof payload.schoolId !== "string" ||
      typeof payload.roleCode !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.sub,
      schoolId: payload.schoolId,
      roleCode: payload.roleCode,
      email: payload.email,
    };
  } catch {
    return null;
  }
}
