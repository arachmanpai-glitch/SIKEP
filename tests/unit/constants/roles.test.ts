import { describe, expect, it } from "vitest";

import { isRoleCode, ROLE_CODES } from "@/constants/roles";

describe("constants/roles", () => {
  it("locks the role set to exactly ADMIN, BENDAHARA, YAYASAN (spec section 3)", () => {
    expect(ROLE_CODES).toEqual(["ADMIN", "BENDAHARA", "YAYASAN"]);
  });

  it("isRoleCode accepts only the fixed 3 codes", () => {
    expect(isRoleCode("ADMIN")).toBe(true);
    expect(isRoleCode("BENDAHARA")).toBe(true);
    expect(isRoleCode("YAYASAN")).toBe(true);
    expect(isRoleCode("KEPALA_SEKOLAH")).toBe(false);
    expect(isRoleCode("")).toBe(false);
  });
});
