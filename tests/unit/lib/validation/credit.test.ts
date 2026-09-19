import { describe, expect, it } from "vitest";

import { applyCreditSchema } from "@/lib/validation/credit";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("lib/validation/credit applyCreditSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      applyCreditSchema.safeParse({ santriId: uuid, billId: uuid, amount: "100000.00" }).success,
    ).toBe(true);
  });

  it("rejects a zero amount", () => {
    expect(
      applyCreditSchema.safeParse({ santriId: uuid, billId: uuid, amount: "0.00" }).success,
    ).toBe(false);
  });
});
