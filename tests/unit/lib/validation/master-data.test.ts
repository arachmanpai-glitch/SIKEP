import { describe, expect, it } from "vitest";

import {
  academicYearCreateSchema,
  billTypeCreateSchema,
  classCreateSchema,
  financialAccountCreateSchema,
  fundSourceCreateSchema,
  transactionCategoryCreateSchema,
} from "@/lib/validation/master-data";

describe("lib/validation/master-data", () => {
  it("academicYearCreateSchema accepts valid input and coerces dates", () => {
    const result = academicYearCreateSchema.safeParse({
      name: "2026/2027",
      startDate: "2026-07-01",
      endDate: "2027-06-30",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startDate).toBeInstanceOf(Date);
    }
  });

  it("classCreateSchema rejects an invalid ClassLevel", () => {
    const result = classCreateSchema.safeParse({
      academicYearId: "11111111-1111-4111-8111-111111111111",
      level: "K7",
      name: "Kelas 7",
    });
    expect(result.success).toBe(false);
  });

  it("classCreateSchema rejects a non-UUID academicYearId", () => {
    const result = classCreateSchema.safeParse({
      academicYearId: "not-a-uuid",
      level: "K1",
      name: "K1-A",
    });
    expect(result.success).toBe(false);
  });

  it("financialAccountCreateSchema rejects a malformed money string", () => {
    const result = financialAccountCreateSchema.safeParse({
      name: "Kas Utama",
      type: "CASH",
      openingBalance: "not-a-number",
    });
    expect(result.success).toBe(false);
  });

  it("financialAccountCreateSchema accepts a valid decimal money string", () => {
    const result = financialAccountCreateSchema.safeParse({
      name: "Kas Utama",
      type: "CASH",
      openingBalance: "500000.00",
    });
    expect(result.success).toBe(true);
  });

  it("fundSourceCreateSchema requires a non-empty name", () => {
    expect(fundSourceCreateSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("transactionCategoryCreateSchema rejects an invalid type", () => {
    const result = transactionCategoryCreateSchema.safeParse({ name: "Donasi", type: "TRANSFER" });
    expect(result.success).toBe(false);
  });

  it("billTypeCreateSchema requires a name", () => {
    expect(billTypeCreateSchema.safeParse({}).success).toBe(false);
  });

  it("every *UpdateSchema makes all fields optional", () => {
    const result = financialAccountCreateSchema.partial().safeParse({});
    expect(result.success).toBe(true);
  });
});
