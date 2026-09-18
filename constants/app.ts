/**
 * Application-wide constants that are true infrastructure/foundation
 * concerns (not business/domain data). Domain master data such as roles,
 * class levels (K1-K6, Pengabdian), and bill types are configurable data
 * seeded into the database in PHASE 4 (MASTER DATA) — they intentionally do
 * NOT live here as hard-coded constants.
 */
export const APP_NAME = "SIKEP";
export const APP_FULL_NAME = "Sistem Informasi Keuangan Pesantren";
export const APP_TAGLINE = "Kelola Keuangan Lebih Mudah, Transparan, dan Terintegrasi.";

export const CURRENCY = "IDR" as const;
export const TIMEZONE = "Asia/Jakarta" as const;
export const LOCALE = "id-ID" as const;

export const API_VERSION = "v1" as const;
export const API_BASE_PATH = `/api/${API_VERSION}` as const;

/** Money columns use PostgreSQL NUMERIC(18,2); never Float. */
export const MONEY_PRECISION = 18;
export const MONEY_SCALE = 2;
