import { describe, expect, it } from "vitest";

import { listAttachmentsQuerySchema, uploadAttachmentMetaSchema } from "@/lib/validation/attachment";

const entityId = "11111111-1111-4111-8111-111111111111";

describe("lib/validation/attachment uploadAttachmentMetaSchema", () => {
  it("accepts each attachable entity type", () => {
    for (const entityType of ["INCOME_TRANSACTION", "EXPENSE_TRANSACTION", "SANTRI_PAYMENT"]) {
      expect(uploadAttachmentMetaSchema.safeParse({ entityType, entityId }).success).toBe(true);
    }
  });

  it("rejects OPENING_BALANCE — no FK column exists for it (D17)", () => {
    expect(
      uploadAttachmentMetaSchema.safeParse({ entityType: "OPENING_BALANCE", entityId }).success,
    ).toBe(false);
  });

  it("rejects a non-UUID entityId", () => {
    expect(
      uploadAttachmentMetaSchema.safeParse({
        entityType: "INCOME_TRANSACTION",
        entityId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });
});

describe("lib/validation/attachment listAttachmentsQuerySchema", () => {
  it("accepts a valid query", () => {
    expect(
      listAttachmentsQuerySchema.safeParse({ entityType: "EXPENSE_TRANSACTION", entityId }).success,
    ).toBe(true);
  });

  it("rejects a missing entityType", () => {
    expect(listAttachmentsQuerySchema.safeParse({ entityId }).success).toBe(false);
  });
});
