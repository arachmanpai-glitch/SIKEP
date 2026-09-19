import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computeBillStatus } from "@/lib/bill-status";

describe("lib/bill-status computeBillStatus", () => {
  it("returns UNPAID when nothing has been paid", () => {
    expect(computeBillStatus(new Prisma.Decimal("500000.00"), new Prisma.Decimal("0.00"))).toBe(
      "UNPAID",
    );
  });

  it("returns PARTIAL when paid amount is between 0 and the full amount", () => {
    expect(
      computeBillStatus(new Prisma.Decimal("500000.00"), new Prisma.Decimal("300000.00")),
    ).toBe("PARTIAL");
  });

  it("returns PAID when paid amount equals the full amount", () => {
    expect(
      computeBillStatus(new Prisma.Decimal("500000.00"), new Prisma.Decimal("500000.00")),
    ).toBe("PAID");
  });

  it("returns PAID when paid amount exceeds the full amount (shouldn't normally happen, but must not misreport PARTIAL)", () => {
    expect(
      computeBillStatus(new Prisma.Decimal("500000.00"), new Prisma.Decimal("600000.00")),
    ).toBe("PAID");
  });
});
