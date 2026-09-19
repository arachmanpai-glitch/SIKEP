import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Double-submit-cookie CSRF protection (spec section 15: "CSRF protection
 * jika cookie-based"). `csrf_token` is a readable (non-HttpOnly) cookie set
 * alongside the session; every state-changing request must echo its value
 * back in an `X-CSRF-Token` header. A cross-site form/script can trigger
 * the request and thus resend the cookie automatically, but it cannot
 * *read* the cookie to also set the header (same-origin policy), so the
 * two won't match. Every mutating PHASE 5+ endpoint must call
 * `verifyCsrfToken` — this module only establishes the mechanism.
 */
export const CSRF_COOKIE_NAME = "sikep_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function verifyCsrfToken(
  cookieValue: string | undefined,
  headerValue: string | undefined,
): boolean {
  if (!cookieValue || !headerValue) return false;
  const cookieBuf = Buffer.from(cookieValue);
  const headerBuf = Buffer.from(headerValue);
  if (cookieBuf.length !== headerBuf.length) return false;
  return timingSafeEqual(cookieBuf, headerBuf);
}
