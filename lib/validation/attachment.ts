import { z } from "zod";

/** Only these three `FinancialEntityType` values have a corresponding
 * nullable FK column on `transaction_attachments` (prisma/schema.prisma,
 * D17) — `OPENING_BALANCE` is part of the shared enum but was never given
 * one, so it is deliberately excluded here. */
export const ATTACHABLE_ENTITY_TYPES = [
  "INCOME_TRANSACTION",
  "EXPENSE_TRANSACTION",
  "SANTRI_PAYMENT",
] as const;

export type AttachableEntityType = (typeof ATTACHABLE_ENTITY_TYPES)[number];

export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const uploadAttachmentMetaSchema = z.object({
  entityType: z.enum(ATTACHABLE_ENTITY_TYPES),
  entityId: z.string().uuid("ID transaksi tidak valid."),
});

export type UploadAttachmentMetaInput = z.infer<typeof uploadAttachmentMetaSchema>;

export const listAttachmentsQuerySchema = z.object({
  entityType: z.enum(ATTACHABLE_ENTITY_TYPES),
  entityId: z.string().uuid("ID transaksi tidak valid."),
});
