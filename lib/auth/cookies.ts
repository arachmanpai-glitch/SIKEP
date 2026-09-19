import { cookies } from "next/headers";

import { CSRF_COOKIE_NAME } from "@/lib/auth/csrf";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";
import { env } from "@/lib/env";

const isProduction = env.NODE_ENV === "production";

/**
 * Sets both the session cookie (HttpOnly — never readable by JS) and the
 * CSRF cookie (readable — the double-submit pattern requires client JS to
 * read it and echo it back in a header) after a successful login.
 */
export async function setSessionCookies(sessionToken: string, csrfToken: string) {
  const store = await cookies();

  store.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  store.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  store.delete(CSRF_COOKIE_NAME);
}

export async function getSessionTokenFromCookies(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value;
}

export async function getCsrfCookieValue(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(CSRF_COOKIE_NAME)?.value;
}
