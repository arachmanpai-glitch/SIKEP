import { describe, expect, it } from "vitest";

import { approvalSettingsUpdateSchema } from "@/lib/validation/settings";

describe("lib/validation/settings", () => {
  it("accepts a valid threshold and boolean", () => {
    const result = approvalSettingsUpdateSchema.safeParse({
      expenseApprovalThreshold: "2000000.00",
      allowNegativeBalance: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-decimal threshold string", () => {
    const result = approvalSettingsUpdateSchema.safeParse({ expenseApprovalThreshold: "banyak" });
    expect(result.success).toBe(false);
  });

  it("allows an empty partial update", () => {
    expect(approvalSettingsUpdateSchema.safeParse({}).success).toBe(true);
  });
});
