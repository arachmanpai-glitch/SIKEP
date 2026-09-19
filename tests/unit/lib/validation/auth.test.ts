import { describe, expect, it } from "vitest";

import { loginSchema } from "@/lib/validation/auth";

describe("lib/validation/auth loginSchema", () => {
  it("accepts a valid email and non-empty password", () => {
    const result = loginSchema.safeParse({ email: "bendahara@sikep.test", password: "rahasia" });
    expect(result.success).toBe(true);
  });

  it("normalizes email to lowercase and trims whitespace", () => {
    const result = loginSchema.parse({ email: "  Bendahara@SIKEP.test  ", password: "x" });
    expect(result.email).toBe("bendahara@sikep.test");
  });

  it("rejects an invalid email", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.test", password: "" }).success).toBe(false);
  });

  it("rejects a missing field", () => {
    expect(loginSchema.safeParse({ email: "a@b.test" }).success).toBe(false);
  });
});
