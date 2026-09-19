import { describe, expect, it } from "vitest";

import { submitExpenseSchema } from "@/lib/validation/expense";

const base = {
  financialAccountId: "11111111-1111-4111-8111-111111111111",
  categoryId: "33333333-3333-4333-8333-333333333333",
  amount: "700000.00",
  transactionDate: "2026-09-18",
};

describe("lib/validation/expense submitExpenseSchema", () => {
  it("accepts a valid payload", () => {
    expect(submitExpenseSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a zero amount", () => {
    expect(submitExpenseSchema.safeParse({ ...base, amount: "0.00" }).success).toBe(false);
  });

  it("rejects a missing categoryId", () => {
    const withoutCategory: Record<string, unknown> = { ...base };
    delete withoutCategory.categoryId;
    expect(submitExpenseSchema.safeParse(withoutCategory).success).toBe(false);
  });
});
