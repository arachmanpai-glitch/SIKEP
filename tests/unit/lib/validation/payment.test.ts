import { describe, expect, it } from "vitest";

import { recordPaymentSchema } from "@/lib/validation/payment";

const uuid = "11111111-1111-4111-8111-111111111111";
const base = {
  santriId: uuid,
  financialAccountId: uuid,
  fundSourceId: uuid,
  categoryId: uuid,
  amount: "500000.00",
  paymentDate: "2026-09-18",
};

describe("lib/validation/payment recordPaymentSchema", () => {
  it("accepts a payload with billIds", () => {
    expect(recordPaymentSchema.safeParse({ ...base, billIds: [uuid] }).success).toBe(true);
  });

  it("defaults billIds to an empty array (pure advance deposit) when omitted", () => {
    const result = recordPaymentSchema.parse(base);
    expect(result.billIds).toEqual([]);
  });

  it("rejects a zero amount", () => {
    expect(recordPaymentSchema.safeParse({ ...base, amount: "0.00" }).success).toBe(false);
  });

  it("rejects a non-UUID entry inside billIds", () => {
    expect(recordPaymentSchema.safeParse({ ...base, billIds: ["not-a-uuid"] }).success).toBe(false);
  });
});
