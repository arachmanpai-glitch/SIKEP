import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // UI (React components/pages) needs browser/E2E coverage, not this
      // Node-environment unit/integration suite (PHASE 11 — no real
      // browser test runner in this environment, see docs/decisions.md).
      // Everything under services/repositories/lib/constants IS covered.
      exclude: ["app/**", "components/**", "prisma/**", "**/*.config.ts", "**/*.d.ts", "tests/**"],
    },
  },
});
