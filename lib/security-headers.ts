/**
 * Baseline security response headers (spec section 15: "XSS protection"
 * plus general hardening) applied to every response via `next.config.ts`
 * `headers()`. Pure functions so they're unit-testable without booting
 * Next.js itself, and so `next.config.ts` and the test share one source
 * of truth instead of the policy string drifting between them.
 *
 * Static (no nonce) CSP — see docs/decisions.md D61 for why nonce-based
 * CSP (the stricter option) was deliberately not used: it forces every
 * page in this app to render dynamically, losing the static optimization
 * most pages currently have, for a marginal gain given this app has zero
 * `dangerouslySetInnerHTML`/user-rendered-HTML surfaces (verified by
 * grep) — the actual script-injection attack surface is already
 * near-zero via React's default escaping.
 */
export function buildContentSecurityPolicy(isDev: boolean): string {
  const header = `
    default-src 'self';
    script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    connect-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `;
  return header.replace(/\s{2,}/g, " ").trim();
}

export interface SecurityHeader {
  key: string;
  value: string;
}

export function getSecurityHeaders(isDev: boolean): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(isDev) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
  ];

  // HSTS only makes sense for an origin actually served over HTTPS — real
  // deployments (PHASE 12) are, `next dev` on localhost is not.
  if (!isDev) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
