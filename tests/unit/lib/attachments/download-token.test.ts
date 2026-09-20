import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  issueAttachmentDownloadToken,
  verifyAttachmentDownloadToken,
} from "@/lib/attachments/download-token";

describe("lib/attachments/download-token", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("issues a token that verifies for the same attachment id and expiry", () => {
    const { token, expiresAtEpochSeconds } = issueAttachmentDownloadToken("att-1");
    expect(verifyAttachmentDownloadToken("att-1", token, expiresAtEpochSeconds)).toBe(true);
  });

  it("rejects the token when checked against a different attachment id", () => {
    const { token, expiresAtEpochSeconds } = issueAttachmentDownloadToken("att-1");
    expect(verifyAttachmentDownloadToken("att-2", token, expiresAtEpochSeconds)).toBe(false);
  });

  it("rejects a tampered token", () => {
    const { expiresAtEpochSeconds } = issueAttachmentDownloadToken("att-1");
    expect(verifyAttachmentDownloadToken("att-1", "tampered-token", expiresAtEpochSeconds)).toBe(
      false,
    );
  });

  it("rejects once the token's expiry has passed", () => {
    const { token, expiresAtEpochSeconds } = issueAttachmentDownloadToken("att-1");
    vi.setSystemTime((expiresAtEpochSeconds + 1) * 1000);
    expect(verifyAttachmentDownloadToken("att-1", token, expiresAtEpochSeconds)).toBe(false);
  });

  it("still accepts the token exactly at its expiry boundary", () => {
    const { token, expiresAtEpochSeconds } = issueAttachmentDownloadToken("att-1");
    vi.setSystemTime(expiresAtEpochSeconds * 1000);
    expect(verifyAttachmentDownloadToken("att-1", token, expiresAtEpochSeconds)).toBe(true);
  });
});
