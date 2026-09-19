import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("lib/auth/password", () => {
  it("hashes a password as Argon2id", async () => {
    const hashed = await hashPassword("Sup3r-Rahasia!");
    expect(hashed).toMatch(/^\$argon2id\$/);
  });

  it("verifies the correct password against its hash", async () => {
    const hashed = await hashPassword("Sup3r-Rahasia!");
    await expect(verifyPassword(hashed, "Sup3r-Rahasia!")).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hashed = await hashPassword("Sup3r-Rahasia!");
    await expect(verifyPassword(hashed, "password-salah")).resolves.toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const [a, b] = await Promise.all([hashPassword("sama-sama"), hashPassword("sama-sama")]);
    expect(a).not.toBe(b);
  });
});
