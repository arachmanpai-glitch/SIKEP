import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/attachments/download-token", () => ({
  issueAttachmentDownloadToken: vi.fn(),
  verifyAttachmentDownloadToken: vi.fn(),
}));
vi.mock("@/lib/storage/attachment-storage", () => ({
  generateAttachmentStorageKey: vi.fn(),
  readAttachmentFile: vi.fn(),
  writeAttachmentFile: vi.fn(),
}));
vi.mock("@/repositories/AttachmentRepository", () => ({
  createAttachment: vi.fn(),
  findAttachmentById: vi.fn(),
  listAttachmentsForEntity: vi.fn(),
}));
vi.mock("@/repositories/ExpenseTransactionRepository", () => ({ findExpenseById: vi.fn() }));
vi.mock("@/repositories/IncomeTransactionRepository", () => ({ findIncomeById: vi.fn() }));
vi.mock("@/repositories/SantriPaymentRepository", () => ({ findSantriPaymentById: vi.fn() }));
vi.mock("@/services/AuditService", () => ({ recordAudit: vi.fn() }));

import {
  issueAttachmentDownloadToken,
  verifyAttachmentDownloadToken,
} from "@/lib/attachments/download-token";
import { env } from "@/lib/env";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  generateAttachmentStorageKey,
  readAttachmentFile,
  writeAttachmentFile,
} from "@/lib/storage/attachment-storage";
import {
  createAttachment,
  findAttachmentById,
  listAttachmentsForEntity,
} from "@/repositories/AttachmentRepository";
import { findExpenseById } from "@/repositories/ExpenseTransactionRepository";
import { findIncomeById } from "@/repositories/IncomeTransactionRepository";
import { findSantriPaymentById } from "@/repositories/SantriPaymentRepository";
import { recordAudit } from "@/services/AuditService";
import {
  createAttachmentDownloadUrl,
  downloadAttachment,
  listAttachments,
  uploadAttachment,
} from "@/services/AttachmentService";

const SESSION = {
  userId: "u1",
  schoolId: "school-a",
  roleCode: "BENDAHARA",
  email: "b@sikep.test",
};

describe("services/AttachmentService.uploadAttachment", () => {
  beforeEach(() => {
    vi.mocked(findIncomeById).mockReset().mockResolvedValue({ id: "inc-1" } as never);
    vi.mocked(findExpenseById).mockReset();
    vi.mocked(findSantriPaymentById).mockReset();
    vi.mocked(generateAttachmentStorageKey)
      .mockReset()
      .mockReturnValue("school-a/INCOME_TRANSACTION/inc-1/uuid-1");
    vi.mocked(writeAttachmentFile).mockReset().mockResolvedValue(undefined);
    vi.mocked(createAttachment)
      .mockReset()
      .mockResolvedValue({ id: "att-1", fileName: "bukti.pdf", mimeType: "application/pdf" } as never);
    vi.mocked(recordAudit).mockReset();
  });

  it("rejects an unsupported mime type", async () => {
    await expect(
      uploadAttachment(SESSION, {
        entityType: "INCOME_TRANSACTION",
        entityId: "inc-1",
        fileName: "malware.exe",
        mimeType: "application/x-msdownload",
        data: Buffer.from("x"),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(createAttachment).not.toHaveBeenCalled();
  });

  it("rejects an empty file", async () => {
    await expect(
      uploadAttachment(SESSION, {
        entityType: "INCOME_TRANSACTION",
        entityId: "inc-1",
        fileName: "kosong.pdf",
        mimeType: "application/pdf",
        data: Buffer.alloc(0),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a file over the configured size limit", async () => {
    await expect(
      uploadAttachment(SESSION, {
        entityType: "INCOME_TRANSACTION",
        entityId: "inc-1",
        fileName: "besar.pdf",
        mimeType: "application/pdf",
        data: Buffer.alloc(env.ATTACHMENT_MAX_FILE_SIZE_BYTES + 1),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws NotFoundError when the referenced income transaction isn't in this school", async () => {
    vi.mocked(findIncomeById).mockResolvedValue(null);
    await expect(
      uploadAttachment(SESSION, {
        entityType: "INCOME_TRANSACTION",
        entityId: "inc-ghost",
        fileName: "bukti.pdf",
        mimeType: "application/pdf",
        data: Buffer.from("bytes"),
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(writeAttachmentFile).not.toHaveBeenCalled();
  });

  it("writes the file, creates the row, and audits CREATE on success", async () => {
    const result = await uploadAttachment(SESSION, {
      entityType: "INCOME_TRANSACTION",
      entityId: "inc-1",
      fileName: "bukti.pdf",
      mimeType: "application/pdf",
      data: Buffer.from("bytes"),
    });

    expect(result).toEqual({ id: "att-1", fileName: "bukti.pdf", mimeType: "application/pdf" });
    expect(writeAttachmentFile).toHaveBeenCalledWith(
      "school-a/INCOME_TRANSACTION/inc-1/uuid-1",
      Buffer.from("bytes"),
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entityType: "TransactionAttachment" }),
    );
  });
});

describe("services/AttachmentService.listAttachments", () => {
  it("throws NotFoundError when the entity doesn't belong to this school", async () => {
    vi.mocked(findExpenseById).mockReset().mockResolvedValue(null);
    await expect(
      listAttachments(SESSION, "EXPENSE_TRANSACTION", "exp-ghost"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns attachments for a valid entity", async () => {
    vi.mocked(findExpenseById).mockReset().mockResolvedValue({ id: "exp-1" } as never);
    vi.mocked(listAttachmentsForEntity)
      .mockReset()
      .mockResolvedValue([{ id: "att-1" }] as never);

    const result = await listAttachments(SESSION, "EXPENSE_TRANSACTION", "exp-1");
    expect(result).toEqual([{ id: "att-1" }]);
  });
});

describe("services/AttachmentService.createAttachmentDownloadUrl", () => {
  beforeEach(() => {
    vi.mocked(findAttachmentById).mockReset();
    vi.mocked(issueAttachmentDownloadToken).mockReset();
  });

  it("throws NotFoundError for an attachment outside this school", async () => {
    vi.mocked(findAttachmentById).mockResolvedValue(null);
    await expect(createAttachmentDownloadUrl(SESSION, "att-ghost")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("returns a url embedding the issued token and expiry", async () => {
    vi.mocked(findAttachmentById).mockResolvedValue({ id: "att-1" } as never);
    vi.mocked(issueAttachmentDownloadToken).mockReturnValue({
      token: "signed-token",
      expiresAtEpochSeconds: 1234567890,
    });

    const result = await createAttachmentDownloadUrl(SESSION, "att-1");
    expect(result.url).toBe(
      "/api/v1/attachments/att-1/download?token=signed-token&expires=1234567890",
    );
  });
});

describe("services/AttachmentService.downloadAttachment", () => {
  beforeEach(() => {
    vi.mocked(findAttachmentById).mockReset();
    vi.mocked(verifyAttachmentDownloadToken).mockReset();
    vi.mocked(readAttachmentFile).mockReset();
    vi.mocked(recordAudit).mockReset();
  });

  it("throws NotFoundError when the attachment doesn't exist in this school", async () => {
    vi.mocked(findAttachmentById).mockResolvedValue(null);
    await expect(downloadAttachment(SESSION, "att-ghost", "token", 1)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws ForbiddenError for an invalid or expired token", async () => {
    vi.mocked(findAttachmentById).mockResolvedValue({ id: "att-1", storageKey: "key" } as never);
    vi.mocked(verifyAttachmentDownloadToken).mockReturnValue(false);
    await expect(downloadAttachment(SESSION, "att-1", "bad-token", 1)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(readAttachmentFile).not.toHaveBeenCalled();
  });

  it("returns the file bytes and audits EXPORT for a valid token", async () => {
    vi.mocked(findAttachmentById).mockResolvedValue({
      id: "att-1",
      storageKey: "key",
      fileName: "bukti.pdf",
      mimeType: "application/pdf",
    } as never);
    vi.mocked(verifyAttachmentDownloadToken).mockReturnValue(true);
    vi.mocked(readAttachmentFile).mockResolvedValue(Buffer.from("bytes"));

    const result = await downloadAttachment(SESSION, "att-1", "good-token", 1);
    expect(result).toEqual({
      fileName: "bukti.pdf",
      mimeType: "application/pdf",
      data: Buffer.from("bytes"),
    });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "EXPORT" }));
  });
});
