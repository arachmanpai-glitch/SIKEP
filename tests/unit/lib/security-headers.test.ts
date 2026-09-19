import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, getSecurityHeaders } from "@/lib/security-headers";

describe("lib/security-headers.buildContentSecurityPolicy", () => {
  it("includes 'unsafe-eval' in development (React error overlay needs it)", () => {
    expect(buildContentSecurityPolicy(true)).toContain("'unsafe-eval'");
  });

  it("excludes 'unsafe-eval' in production", () => {
    expect(buildContentSecurityPolicy(false)).not.toContain("'unsafe-eval'");
  });

  it("blocks framing entirely and forbids plugins/objects", () => {
    const csp = buildContentSecurityPolicy(false);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("restricts default-src to same-origin", () => {
    expect(buildContentSecurityPolicy(false)).toContain("default-src 'self'");
  });
});

describe("lib/security-headers.getSecurityHeaders", () => {
  it("always sets the core hardening headers", () => {
    const keys = getSecurityHeaders(false).map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "X-Frame-Options",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
  });

  it("sets X-Frame-Options to DENY and X-Content-Type-Options to nosniff", () => {
    const headers = getSecurityHeaders(false);
    expect(headers.find((h) => h.key === "X-Frame-Options")?.value).toBe("DENY");
    expect(headers.find((h) => h.key === "X-Content-Type-Options")?.value).toBe("nosniff");
  });

  it("includes Strict-Transport-Security only outside development", () => {
    expect(getSecurityHeaders(false).some((h) => h.key === "Strict-Transport-Security")).toBe(true);
    expect(getSecurityHeaders(true).some((h) => h.key === "Strict-Transport-Security")).toBe(false);
  });
});
