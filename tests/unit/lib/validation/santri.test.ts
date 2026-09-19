import { describe, expect, it } from "vitest";

import { santriCreateSchema, santriUpdateSchema } from "@/lib/validation/santri";

describe("lib/validation/santri", () => {
  it("accepts minimal valid input (only nis + fullName)", () => {
    expect(santriCreateSchema.safeParse({ nis: "2026001", fullName: "Ahmad" }).success).toBe(true);
  });

  it("rejects an empty nis", () => {
    expect(santriCreateSchema.safeParse({ nis: "", fullName: "Ahmad" }).success).toBe(false);
  });

  it("rejects an invalid status", () => {
    const result = santriCreateSchema.safeParse({ nis: "1", fullName: "Ahmad", status: "LULUS" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID classId", () => {
    const result = santriCreateSchema.safeParse({
      nis: "1",
      fullName: "Ahmad",
      classId: "kelas-1",
    });
    expect(result.success).toBe(false);
  });

  it("santriUpdateSchema allows a fully empty partial update", () => {
    expect(santriUpdateSchema.safeParse({}).success).toBe(true);
  });
});
