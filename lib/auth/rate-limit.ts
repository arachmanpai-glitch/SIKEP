/**
 * In-memory sliding-window rate limiter for login attempts (spec section
 * 15: "rate limiting"). Deliberately minimal for a single-instance
 * deployment — state lives in process memory and resets on restart/scale.
 * If SIKEP is later deployed across multiple instances, move this to a
 * shared store (e.g. Redis) so limits are enforced consistently; noted
 * here rather than silently left as a scaling trap (see docs/decisions.md
 * D19).
 */
interface Attempt {
  count: number;
  windowStartedAt: number;
}

const attempts = new Map<string, Attempt>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS_PER_WINDOW = 5;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export function checkLoginRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const existing = attempts.get(key);

  if (!existing || now - existing.windowStartedAt >= WINDOW_MS) {
    attempts.set(key, { count: 1, windowStartedAt: now });
    return { allowed: true };
  }

  if (existing.count >= MAX_ATTEMPTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((existing.windowStartedAt + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  existing.count += 1;
  return { allowed: true };
}

/** Test-only: clears all rate-limit state between test cases. */
export function resetLoginRateLimit(): void {
  attempts.clear();
}
