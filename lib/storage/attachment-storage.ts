import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/lib/env";
import type { AttachableEntityType } from "@/lib/validation/attachment";

/**
 * Private, non-web-served local-disk storage for "Bukti Transaksi"
 * (transaction evidence) attachments (docs/decisions.md D75). Lives outside
 * `public/` so Next.js never serves it directly — every read goes through
 * app/api/v1/attachments/[id]/download, which enforces session + tenant +
 * signed-token checks (lib/attachments/download-token.ts).
 *
 * `turbopackIgnore` below: ATTACHMENT_STORAGE_DIR is deliberately
 * env-driven (not a static literal) so ops can relocate the disk without a
 * code change — Turbopack can't prove that statically, so it would
 * otherwise trace and bundle the ENTIRE project as a server dependency
 * (docs/deployment.md). Accepted trade-off: changing this env var requires
 * a redeploy, same as every other lib/env.ts value.
 */
const baseDir = path.resolve(/* turbopackIgnore: true */ process.cwd(), env.ATTACHMENT_STORAGE_DIR);

/**
 * The key is entirely server-generated — schoolId/entityId are UUIDs,
 * entityType is a validated enum, and the random suffix is a fresh UUID.
 * No user-supplied path segment (e.g. the original filename) ever reaches
 * the filesystem path, which rules out path traversal by construction
 * rather than by sanitization.
 */
export function generateAttachmentStorageKey(
  schoolId: string,
  entityType: AttachableEntityType,
  entityId: string,
): string {
  return path.posix.join(schoolId, entityType, entityId, randomUUID());
}

function resolveAttachmentPath(storageKey: string): string {
  // Same turbopackIgnore rationale as `baseDir` above — `storageKey` is
  // always server-generated (see generateAttachmentStorageKey), never
  // user input, so this is not a path-traversal opt-out.
  return path.join(/* turbopackIgnore: true */ baseDir, storageKey);
}

export async function writeAttachmentFile(storageKey: string, data: Buffer): Promise<void> {
  const filePath = resolveAttachmentPath(storageKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
}

export async function readAttachmentFile(storageKey: string): Promise<Buffer> {
  return readFile(resolveAttachmentPath(storageKey));
}
