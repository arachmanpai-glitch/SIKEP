import { describe, expect, it } from "vitest";

import { generateCsrfToken, verifyCsrfToken } from "@/lib/auth/csrf";

describe("lib/auth/csrf", () => {
  it("generates a sufficiently long random token", () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(64); // 32 bytes as hex
  });

  it("generates a different token on each call", () => {
    expect(generateCsrfToken()).not.toBe(generateCsrfToken());
  });

  it("accepts a request when the header matches the cookie", () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(token, token)).toBe(true);
  });

  it("rejects when the header doesn't match the cookie", () => {
    expect(verifyCsrfToken(generateCsrfToken(), generateCsrfToken())).toBe(false);
  });

  it("rejects when either value is missing", () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(undefined, token)).toBe(false);
    expect(verifyCsrfToken(token, undefined)).toBe(false);
    expect(verifyCsrfToken(undefined, undefined)).toBe(false);
  });
});
