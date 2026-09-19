import { describe, expect, it } from "vitest";

import { rejectApprovalSchema } from "@/lib/validation/approval";

describe("lib/validation/approval rejectApprovalSchema", () => {
  it("accepts a non-empty reason", () => {
    expect(rejectApprovalSchema.safeParse({ reason: "Anggaran tidak sesuai" }).success).toBe(true);
  });

  it("rejects an empty reason (spec: rejection wajib memiliki alasan)", () => {
    expect(rejectApprovalSchema.safeParse({ reason: "" }).success).toBe(false);
  });

  it("rejects a missing reason", () => {
    expect(rejectApprovalSchema.safeParse({}).success).toBe(false);
  });
});
