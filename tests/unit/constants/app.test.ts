import { describe, expect, it } from "vitest";

import { API_BASE_PATH, CURRENCY, MONEY_SCALE, TIMEZONE } from "@/constants/app";

describe("constants/app", () => {
  it("pins currency to IDR and timezone to Asia/Jakarta", () => {
    expect(CURRENCY).toBe("IDR");
    expect(TIMEZONE).toBe("Asia/Jakarta");
  });

  it("uses 2 decimal places for money, matching NUMERIC(18,2)", () => {
    expect(MONEY_SCALE).toBe(2);
  });

  it("versions the API under /api/v1", () => {
    expect(API_BASE_PATH).toBe("/api/v1");
  });
});
