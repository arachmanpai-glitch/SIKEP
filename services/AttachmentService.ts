import type { TransactionAttachment } from "@prisma/client";

import {
  issueAttachmentDownloadToken,
  verifyAttachmentDownloadToken,
} from "@/lib/attachments/download-token";
import type { SessionPayload } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  generateAttachmentStorageKey,
  readAttachmentFile,
  writeAttachmentFile,
} from "@/lib/storage/attachment-storage";
import { ATTACHMENT_ALLOWED_MIME_TYPES, type AttachableEntityType } from "@/lib/validation/attachment";
import {
  createAttachment,
  findAttachmentById,
  listAttachmentsForEntity,
} from "@/repositories/AttachmentRepository";
import { findExpenseById } from "@/repositories/ExpenseTransactionRepository";
import { findIncomeById } from "@/repositories/IncomeTransactionRepository";
import { findSantriPaymentById } from "@/repositories/SantriPaymentRepository";
import { recordAudit } from "@/services/AuditService";

const log = logger.child({ module: "AttachmentService" });

/** Confirms the referenced income/expense/payment actually exists AND
 * belongs to the caller's school (tenant isolation, spec section 14) —
 * never trust an `entityId` supplied by the client on its own. */
async function assertEntityBelongsToSchool(
  schoolId: string,
  entityType: AttachableEntityType,
  entityId: string,
): Promise<void> {
  const found =
    entityType === "INCOME_TRANSACTION"
      ? await findIncomeById(schoolId, entityId)
      : entityType === "EXPENSE_TRANSACTION"
        ? await findExpenseById(schoolId, entityId)
        : await findSantriPaymentById(schoolId, entityId);

  if (!found) {
    throw new NotFoundError("Transaksi rujukan lampiran");
  }
}

export interface UploadAttachmentInput {
  entityType: AttachableEntityType;
  entityId: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
}

export async function uploadAttachment(
  session: SessionPayload,
  input: UploadAttachmentInput,
): Promise<TransactionAttachment> {
  if (!(ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    throw new ValidationError(
      `Tipe file "${input.mimeType}" tidak didukung. Tipe yang diizinkan: ${ATTACHMENT_ALLOWED_MIME_TYPES.join(", ")}.`,
    );
  }
  if (input.data.byteLength === 0) {
    throw new ValidationError("File kosong.");
  }
  if (input.data.byteLength > env.ATTACHMENT_MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(
      `Ukuran file melebihi batas maksimum ${env.ATTACHMENT_MAX_FILE_SIZE_BYTES} byte.`,
    );
  }

  await assertEntityBelongsToSchool(session.schoolId, input.entityType, input.entityId);

  const storageKey = generateAttachmentStorageKey(
    session.schoolId,
    input.entityType,
    input.entityId,
  );
  await writeAttachmentFile(storageKey, input.data);

  const created = await createAttachment({
    schoolId: session.schoolId,
    entityType: input.entityType,
    entityId: input.entityId,
    storageKey,
    fileName: input.fileName.slice(0, 255),
    mimeType: input.mimeType,
    fileSizeBytes: input.data.byteLength,
    uploadedById: session.userId,
  });

  await recordAudit({
    schoolId: session.schoolId,
    userId: session.userId,
    action: "CREATE",
    entityType: "TransactionAttachment",
    entityId: created.id,
    newValues: {
      fileName: created.fileName,
      mimeType: created.mimeType,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });

  log.info({ attachmentId: created.id, entityType: input.entityType }, "Attachment uploaded");
  return created;
}

export async function listAttachments(
  session: SessionPayload,
  entityType: AttachableEntityType,
  entityId: string,
): Promise<TransactionAttachment[]> {
  await assertEntityBelongsToSchool(session.schoolId, entityType, entityId);
  return listAttachmentsForEntity(session.schoolId, entityType, entityId);
}

export interface AttachmentDownloadUrl {
  url: string;
  expiresAtEpochSeconds: number;
}

export async function createAttachmentDownloadUrl(
  session: SessionPayload,
  attachmentId: string,
): Promise<AttachmentDownloadUrl> {
  const attachment = await findAttachmentById(session.schoolId, attachmentId);
  if (!attachment) throw new NotFoundError("Lampiran");

  const { token, expiresAtEpochSeconds } = issueAttachmentDownloadToken(attachment.id);
  const url = `/api/v1/attachments/${attachment.id}/download?token=${token}&expires=${expiresAtEpochSeconds}`;
  return { url, expiresAtEpochSeconds };
}

export interface AttachmentFile {
  fileName: string;
  mimeType: string;
  data: Buffer;
}

/** See docs/decisions.md D50 for the same pattern (EXPORT audit write on a
 * GET route) — deliberate, scoped to audit_logs only, never domain data. */
export async function downloadAttachment(
  session: SessionPayload,
  attachmentId: string,
  token: string,
  expiresAtEpochSeconds: number,
): Promise<AttachmentFile> {
  const attachment = await findAttachmentById(session.schoolId, attachmentId);
  if (!attachment) throw new NotFoundError("Lampiran");

  if (!verifyAttachmentDownloadToken(attachment.id, token, expiresAtEpochSeconds)) {
    throw new ForbiddenError("Tautan unduhan tidak valid atau sudah kedaluwarsa.");
  }

  const data = await readAttachmentFile(attachment.storageKey);

  await recordAudit({
    schoolId: session.schoolId,
    userId: session.userId,
    action: "EXPORT",
    entityType: "TransactionAttachment",
    entityId: attachment.id,
  });

  return { fileName: attachment.fileName, mimeType: attachment.mimeType, data };
}
