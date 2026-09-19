import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

/**
 * Coarse route gate (Next.js 16 "Proxy" convention — the renamed successor
 * to Middleware, defaults to the Node.js runtime): redirects unauthenticated
 * visitors away from protected pages to /login, and already-authenticated
 * visitors away from /login. This is a UX convenience, NOT the
 * authorization boundary — every API route / server action still calls
 * requireSession()/requireRole() itself (lib/rbac.ts). Only verifies the
 * JWT signature/expiry (lib/auth/session.ts); it does not check
 * `isActive`/`deletedAt` against the database.
 */
const PUBLIC_PATHS = ["/", "/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // /api/** always returns its own JSON via requireSession()/requireRole()
  // (lib/rbac.ts) — never redirected to the HTML /login page. A redirect
  // here would hand an unauthenticated fetch() caller (see lib/client/
  // api.ts) an HTML document where it expects `{ success, data|error }`,
  // breaking `response.json()` instead of surfacing a clean 401/403.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!PUBLIC_PATHS.includes(pathname) && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // /admin/** is Admin-only at the UX level too (every underlying API
  // route already enforces this for real via requireRole("ADMIN") —
  // lib/rbac.ts — this just avoids showing a Bendahara/Yayasan a page that
  // would only error on every action).
  if (pathname.startsWith("/admin") && session && session.roleCode !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.\\w+$).*)"],
};
