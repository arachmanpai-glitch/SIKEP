import { beforeEach, describe, expect, it } from "vitest";

import { checkLoginRateLimit, resetLoginRateLimit } from "@/lib/auth/rate-limit";

describe("lib/auth/rate-limit", () => {
  beforeEach(() => {
    resetLoginRateLimit();
  });

  it("allows the first 5 attempts within a window", () => {
    const key = "127.0.0.1:user@sikep.test";
    for (let i = 0; i < 5; i++) {
      expect(checkLoginRateLimit(key).allowed).toBe(true);
    }
  });

  it("blocks the 6th attempt within the same window", () => {
    const key = "127.0.0.1:user@sikep.test";
    for (let i = 0; i < 5; i++) {
      checkLoginRateLimit(key);
    }
    const result = checkLoginRateLimit(key);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    const keyA = "127.0.0.1:a@sikep.test";
    const keyB = "127.0.0.1:b@sikep.test";
    for (let i = 0; i < 5; i++) {
      checkLoginRateLimit(keyA);
    }
    expect(checkLoginRateLimit(keyA).allowed).toBe(false);
    expect(checkLoginRateLimit(keyB).allowed).toBe(true);
  });
});
