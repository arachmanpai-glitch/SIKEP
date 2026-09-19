import type { ApprovalSettings } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { Tx } from "@/repositories/LedgerRepository";

/** One row per school. Lazily created with schema defaults on first read
 * (threshold Rp1.000.000, allowNegativeBalance false — spec section 11),
 * rather than requiring an explicit provisioning step.
 *
 * Accepts an optional transaction client so ExpenseService can read the
 * threshold/allowNegativeBalance inside the SAME Serializable transaction
 * as its balance check — the top-level `prisma` singleton is structurally
 * assignable to `Tx`, so callers outside a transaction just omit it. */
export async function getOrCreateApprovalSettings(
  schoolId: string,
  client: Tx = prisma,
): Promise<ApprovalSettings> {
  const existing = await client.approvalSettings.findUnique({ where: { schoolId } });
  if (existing) return existing;
  return client.approvalSettings.create({ data: { schoolId } });
}

export interface UpdateApprovalSettingsData {
  expenseApprovalThreshold?: string;
  allowNegativeBalance?: boolean;
  updatedById: string;
}

export async function updateApprovalSettings(
  schoolId: string,
  data: UpdateApprovalSettingsData,
): Promise<ApprovalSettings> {
  await getOrCreateApprovalSettings(schoolId);
  return prisma.approvalSettings.update({ where: { schoolId }, data });
}
