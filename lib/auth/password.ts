import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id password hashing (spec section 15). Parameters follow OWASP's
 * current minimum recommendation for Argon2id (m=19MiB, t=2, p=1) — tuned
 * for a web login path, not a low-latency hot path.
 *
 * `algorithm: 2` is `Algorithm.Argon2id` from `@node-rs/argon2` — that enum
 * is declared `const enum`, which TypeScript can't reference as a value
 * under `isolatedModules` (required by Next.js's per-file SWC compiler),
 * so the numeric value is inlined here instead.
 */
const ARGON2ID_OPTIONS = {
  algorithm: 2, // Algorithm.Argon2id
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, ARGON2ID_OPTIONS);
}

export async function verifyPassword(
  hashedPassword: string,
  plainPassword: string,
): Promise<boolean> {
  return verify(hashedPassword, plainPassword);
}
