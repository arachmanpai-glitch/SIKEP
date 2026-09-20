import { defineConfig, devices } from "@playwright/test";

import { resolveE2eDatabaseUrl } from "./tests/e2e/db";

const PORT = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : 3100;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * E2E config (docs/decisions.md D81) — separate from `vitest.config.ts`
 * (unit/integration, no real DB/browser). Drives a real Chromium browser
 * against a real `next dev` server backed by a real, dedicated Postgres
 * database (`sikep_e2e`), filling the gap tracked since PHASE 11
 * (docs/step11/00-progress.md): login → fill form → submit → verify
 * persisted, for real.
 *
 * Runs single-worker/non-parallel deliberately: every spec shares the same
 * E2E database (reset once per run in globalSetup, not per test), so
 * concurrent specs could see each other's in-progress writes. That
 * trade-off is fine here — this suite is a handful of golden-path
 * scenarios, not a large parallelizable matrix.
 */
export default defineConfig({
  testDir: "./tests/e2e/specs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    // Deliberately NOT `!process.env.CI` (Playwright's usual default):
    // reusing a server someone left running on this port could mean
    // reusing one still pointed at a different DATABASE_URL. Always
    // spawning our own guarantees it's wired to `sikep_e2e`.
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: resolveE2eDatabaseUrl(),
    },
  },
});
