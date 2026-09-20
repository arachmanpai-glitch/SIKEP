import { z } from "zod";

/**
 * Validated environment configuration. Import `env` instead of reading
 * `process.env` directly so misconfiguration fails fast at boot, not at
 * a random request deep in a financial mutation.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("Asia/Jakarta"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  /** HS256 JWT signing secret for session cookies (lib/auth/session.ts).
   * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET wajib diisi, minimal 32 karakter"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  /** Private local-disk root for "Bukti Transaksi" attachments (docs/decisions.md
   * D75) — resolved relative to the project root, lives outside `public/` so
   * Next.js never serves it directly. Swap for an S3-compatible bucket later
   * without touching callers by replacing lib/storage/attachment-storage.ts. */
  ATTACHMENT_STORAGE_DIR: z.string().min(1).default("./storage/attachments"),
  ATTACHMENT_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(10_000_000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Konfigurasi environment tidak valid:\n${issues}`);
  }

  return parsed.data;
}

export const env = loadEnv();
