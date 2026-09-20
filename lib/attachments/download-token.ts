import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Short-lived signed download token (docs/decisions.md D75) — a locally
 * computed stand-in for an S3 presigned URL's signature + expiry, since
 * attachments live on local disk (lib/storage/attachment-storage.ts), not
 * in an actual object store. Deliberately NOT a bearer credential on its
 * own: app/api/v1/attachments/[id]/download still requires a valid session
 * (lib/rbac.ts — every route re-checks its own authorization), so this
 * token's only job is to time-box how long one issued attachment link
 * stays valid, independent of the (much longer) session lifetime.
 */
const TOKEN_TTL_SECONDS = 5 * 60;

// Key separation from AUTH_SECRET's other use (JWT session signing,
// lib/auth/session.ts) — same secret material, different derived key.
const signingKey = createHash("sha256").update(`${env.AUTH_SECRET}:attachment-download`).digest();

function sign(attachmentId: string, expiresAtEpochSeconds: number): string {
  return createHmac("sha256", signingKey)
    .update(`${attachmentId}.${expiresAtEpochSeconds}`)
    .digest("base64url");
}

export interface AttachmentDownloadToken {
  token: string;
  expiresAtEpochSeconds: number;
}

export function issueAttachmentDownloadToken(attachmentId: string): AttachmentDownloadToken {
  const expiresAtEpochSeconds = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  return { token: sign(attachmentId, expiresAtEpochSeconds), expiresAtEpochSeconds };
}

export function verifyAttachmentDownloadToken(
  attachmentId: string,
  token: string,
  expiresAtEpochSeconds: number,
): boolean {
  if (Math.floor(Date.now() / 1000) > expiresAtEpochSeconds) return false;

  const expected = Buffer.from(sign(attachmentId, expiresAtEpochSeconds));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
