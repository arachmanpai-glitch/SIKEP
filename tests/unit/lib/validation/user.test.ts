import { describe, expect, it } from "vitest";

import { userCreateSchema, userUpdateSchema } from "@/lib/validation/user";

describe("lib/validation/user", () => {
  it("accepts a valid user creation payload", () => {
    const result = userCreateSchema.safeParse({
      fullName: "Budi Bendahara",
      email: "budi@sikep.test",
      password: "password123",
      roleCode: "BENDAHARA",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = userCreateSchema.safeParse({
      fullName: "Budi",
      email: "budi@sikep.test",
      password: "short",
      roleCode: "BENDAHARA",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a roleCode outside the fixed 3-role set (no Kepala Sekolah)", () => {
    const result = userCreateSchema.safeParse({
      fullName: "Budi",
      email: "budi@sikep.test",
      password: "password123",
      roleCode: "KEPALA_SEKOLAH",
    });
    expect(result.success).toBe(false);
  });

  it("userUpdateSchema allows updating just isActive", () => {
    expect(userUpdateSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("userUpdateSchema still enforces the 8-char minimum when password is provided", () => {
    expect(userUpdateSchema.safeParse({ password: "short" }).success).toBe(false);
  });
});
