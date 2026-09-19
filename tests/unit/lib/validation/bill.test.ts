import { describe, expect, it } from "vitest";

import { createBillSchema, createBulkBillsSchema } from "@/lib/validation/bill";

const uuid1 = "11111111-1111-4111-8111-111111111111";
const uuid2 = "22222222-2222-4222-8222-222222222222";
const uuid3 = "33333333-3333-4333-8333-333333333333";

describe("lib/validation/bill createBillSchema", () => {
  it("accepts a minimal valid payload", () => {
    expect(
      createBillSchema.safeParse({
        santriId: uuid1,
        billTypeId: uuid2,
        academicYearId: uuid3,
        amount: "500000.00",
      }).success,
    ).toBe(true);
  });

  it("rejects a zero amount", () => {
    expect(
      createBillSchema.safeParse({
        santriId: uuid1,
        billTypeId: uuid2,
        academicYearId: uuid3,
        amount: "0.00",
      }).success,
    ).toBe(false);
  });
});

describe("lib/validation/bill createBulkBillsSchema", () => {
  it("accepts multiple santriIds", () => {
    const result = createBulkBillsSchema.safeParse({
      santriIds: [uuid1, uuid2],
      billTypeId: uuid3,
      academicYearId: uuid3,
      amount: "500000.00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty santriIds array", () => {
    const result = createBulkBillsSchema.safeParse({
      santriIds: [],
      billTypeId: uuid3,
      academicYearId: uuid3,
      amount: "500000.00",
    });
    expect(result.success).toBe(false);
  });
});
