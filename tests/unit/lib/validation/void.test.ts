import { describe, expect, it } from "vitest";

import { voidTransactionSchema } from "@/lib/validation/void";

describe("lib/validation/void voidTransactionSchema", () => {
  it("accepts a non-empty reason", () => {
    expect(voidTransactionSchema.safeParse({ reason: "Salah input jumlah" }).success).toBe(true);
  });

  it("rejects an empty reason (spec: rejection/void wajib memiliki alasan)", () => {
    expect(voidTransactionSchema.safeParse({ reason: "" }).success).toBe(false);
  });

  it("rejects a missing reason", () => {
    expect(voidTransactionSchema.safeParse({}).success).toBe(false);
  });
});
