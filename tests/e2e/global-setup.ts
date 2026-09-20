import { execFileSync } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";

import { resolveE2eDatabaseUrl } from "./db";
import { seedE2eDatabase } from "./seed";

/** Postgres error code for "database already exists" — expected on every
 * run after the first, not a real failure. */
const PG_DUPLICATE_DATABASE = "42P04";

async function ensureDatabaseExists(databaseUrl: string): Promise<void> {
  const target = new URL(databaseUrl);
  const dbName = target.pathname.replace(/^\//, "");

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres"; // always-present maintenance DB, needed to run CREATE DATABASE

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`[e2e] Created database "${dbName}".`);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== PG_DUPLICATE_DATABASE) {
      throw new Error(
        `[e2e] Gagal membuat database "${dbName}": ${(error as Error).message}\n` +
          `Role di DATABASE_URL butuh hak CREATEDB, atau buat manual sekali: ` +
          `CREATE DATABASE "${dbName}";`,
      );
    }
  } finally {
    await client.end();
  }
}

/**
 * Runs once before the whole E2E suite (docs/decisions.md D81): makes sure
 * a dedicated `sikep_e2e` database exists (separate from the dev `sikep`
 * database), applies every migration to it, then rebuilds the deterministic
 * fixture (tests/e2e/seed.ts). `playwright.config.ts`'s `webServer.env`
 * points the Next.js dev server it starts at this same database — both
 * sides call `resolveE2eDatabaseUrl()` independently rather than passing
 * the value between them, so there is no ordering dependency between this
 * hook and the web server starting.
 */
export default async function globalSetup(): Promise<void> {
  const databaseUrl = resolveE2eDatabaseUrl();

  await ensureDatabaseExists(databaseUrl);

  // `shell: true` is required on Windows to resolve the `npx.cmd` shim
  // (calling it directly via execFileSync throws EINVAL — a known Node/
  // Windows quirk, not specific to this script) — Node's deprecation
  // warning on this option is about unescaped shell concatenation of
  // ARGUMENTS, which is a non-issue here: every argument below is a fixed
  // literal, never interpolated from user input or `.env`.
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
    shell: process.platform === "win32",
  });

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });
  try {
    await seedE2eDatabase(prisma);
    console.log("[e2e] Fixture data seeded.");
  } finally {
    await prisma.$disconnect();
  }
}
