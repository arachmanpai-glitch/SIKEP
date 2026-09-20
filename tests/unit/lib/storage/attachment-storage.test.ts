import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
}));

import { mkdir, readFile, writeFile } from "node:fs/promises";

import {
  generateAttachmentStorageKey,
  readAttachmentFile,
  writeAttachmentFile,
} from "@/lib/storage/attachment-storage";

describe("lib/storage/attachment-storage generateAttachmentStorageKey", () => {
  it("builds a school/entityType/entityId/uuid key with no user-supplied segment", () => {
    const key = generateAttachmentStorageKey("school-1", "INCOME_TRANSACTION", "inc-1");
    const segments = key.split("/");
    expect(segments[0]).toBe("school-1");
    expect(segments[1]).toBe("INCOME_TRANSACTION");
    expect(segments[2]).toBe("inc-1");
    expect(segments[3]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("generates a distinct key on every call (never reused/overwritten)", () => {
    const a = generateAttachmentStorageKey("school-1", "INCOME_TRANSACTION", "inc-1");
    const b = generateAttachmentStorageKey("school-1", "INCOME_TRANSACTION", "inc-1");
    expect(a).not.toBe(b);
  });
});

describe("lib/storage/attachment-storage write/read", () => {
  beforeEach(() => {
    vi.mocked(mkdir).mockReset().mockResolvedValue(undefined as never);
    vi.mocked(writeFile).mockReset().mockResolvedValue(undefined as never);
    vi.mocked(readFile)
      .mockReset()
      .mockResolvedValue(Buffer.from("evidence-bytes") as never);
  });

  it("creates the parent directory before writing the file", async () => {
    await writeAttachmentFile("school-1/INCOME_TRANSACTION/inc-1/some-uuid", Buffer.from("hi"));

    expect(mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    const writtenPath = vi.mocked(writeFile).mock.calls[0]?.[0];
    expect(String(writtenPath)).toContain("some-uuid");
  });

  it("reads the file at the resolved storage key path", async () => {
    const data = await readAttachmentFile("school-1/INCOME_TRANSACTION/inc-1/some-uuid");

    expect(data.toString()).toBe("evidence-bytes");
    const readPath = vi.mocked(readFile).mock.calls[0]?.[0];
    expect(String(readPath)).toContain("some-uuid");
  });
});
