import "dotenv/config";

const DEFAULT_E2E_DB_NAME = "sikep_e2e";

/**
 * Derives the E2E database's connection string from the SAME DATABASE_URL
 * already configured for local development (`.env`) — same host/user/
 * password/port, only the database name changes (docs/decisions.md D81).
 * Avoids ever hardcoding or re-entering Postgres credentials for E2E, and
 * avoids ever touching `.env` itself: whatever role already works for
 * `npm run dev` is reused here, unmodified.
 */
export function resolveE2eDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      "DATABASE_URL tidak diset. E2E test butuh .env terisi seperti setup development " +
        "biasa (lihat docs/development.md) — hanya nama database yang diganti otomatis.",
    );
  }

  const url = new URL(base);
  url.pathname = `/${process.env.E2E_DATABASE_NAME ?? DEFAULT_E2E_DB_NAME}`;
  return url.toString();
}
