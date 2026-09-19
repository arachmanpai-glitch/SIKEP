import { describe, expect, it } from "vitest";

import { recordIncomeSchema } from "@/lib/validation/income";

const base = {
  financialAccountId: "11111111-1111-4111-8111-111111111111",
  fundSourceId: "22222222-2222-4222-8222-222222222222",
  categoryId: "33333333-3333-4333-8333-333333333333",
  amount: "500000.00",
  transactionDate: "2026-09-18",
};

describe("lib/validation/income recordIncomeSchema", () => {
  it("accepts a valid payload", () => {
    expect(recordIncomeSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a zero amount (must be > 0)", () => {
    expect(recordIncomeSchema.safeParse({ ...base, amount: "0.00" }).success).toBe(false);
  });

  it("rejects a negative amount", () => {
    expect(recordIncomeSchema.safeParse({ ...base, amount: "-100.00" }).success).toBe(false);
  });

  it("rejects a non-decimal amount string", () => {
    expect(recordIncomeSchema.safeParse({ ...base, amount: "lima ratus ribu" }).success).toBe(
      false,
    );
  });

  it("rejects a non-UUID financialAccountId", () => {
    expect(
      recordIncomeSchema.safeParse({ ...base, financialAccountId: "not-a-uuid" }).success,
    ).toBe(false);
  });
});
