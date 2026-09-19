import type { NextConfig } from "next";

// Relative import (not the "@/*" alias) — next.config.ts is loaded by
// Next's own bootstrap step, before webpack/tsconfig path aliases are set
// up, so alias resolution here is not guaranteed.
import { getSecurityHeaders } from "./lib/security-headers";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // Don't advertise the framework in responses (spec section 15 hardening —
  // minor info-disclosure reduction, not a real barrier on its own).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: getSecurityHeaders(isDev),
      },
    ];
  },
};

export default nextConfig;
