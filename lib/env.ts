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
  AUTH_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
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
