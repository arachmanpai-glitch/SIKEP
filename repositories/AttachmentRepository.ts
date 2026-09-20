import type { TransactionAttachment } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { AttachableEntityType } from "@/lib/validation/attachment";

export interface CreateAttachmentData {
  schoolId: string;
  entityType: AttachableEntityType;
  entityId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedById: string;
}

/** Exactly one of the three typed FK columns is set, matching `entityType`
 * (D17) — never a raw `entityId` cast into all three. */
function entityForeignKeys(entityType: AttachableEntityType, entityId: string) {
  switch (entityType) {
    case "INCOME_TRANSACTION":
      return { incomeTransactionId: entityId };
    case "EXPENSE_TRANSACTION":
      return { expenseTransactionId: entityId };
    case "SANTRI_PAYMENT":
      return { santriPaymentId: entityId };
  }
}

export async function createAttachment(data: CreateAttachmentData): Promise<TransactionAttachment> {
  return prisma.transactionAttachment.create({
    data: {
      schoolId: data.schoolId,
      entityType: data.entityType,
      entityId: data.entityId,
      storageKey: data.storageKey,
      fileName: data.fileName,
      mimeType: data.mimeType,
      fileSizeBytes: data.fileSizeBytes,
      uploadedById: data.uploadedById,
      ...entityForeignKeys(data.entityType, data.entityId),
    },
  });
}

export async function listAttachmentsForEntity(
  schoolId: string,
  entityType: AttachableEntityType,
  entityId: string,
): Promise<TransactionAttachment[]> {
  return prisma.transactionAttachment.findMany({
    where: { schoolId, entityType, entityId },
    orderBy: { createdAt: "desc" },
  });
}

export async function findAttachmentById(
  schoolId: string,
  id: string,
): Promise<TransactionAttachment | null> {
  return prisma.transactionAttachment.findFirst({ where: { id, schoolId } });
}
