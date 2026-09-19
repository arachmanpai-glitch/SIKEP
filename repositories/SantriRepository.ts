import type { Santri } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { Tx } from "@/repositories/LedgerRepository";
import type { SantriCreateInput, SantriUpdateInput } from "@/lib/validation/santri";
import type { MasterDataAdapter } from "@/services/masterDataService";

/** Tx-scoped lookup for PHASE 6 (PaymentService/CreditService) to validate
 * a santriId inside their own transaction — separate from the
 * `santriAdapter.findById` above, which always uses the top-level `prisma`. */
export async function findActiveSantri(
  tx: Tx,
  schoolId: string,
  id: string,
): Promise<Santri | null> {
  return tx.santri.findFirst({ where: { id, schoolId, deletedAt: null } });
}

/** Reuses the same CRUD/audit/tenant-scoping orchestration as the 6
 * generic master-data entities (services/masterDataService.ts) — Santri's
 * PHASE 4 needs are structurally identical (tenant-scoped, soft-deletable
 * list). It gets a dedicated API path (/api/v1/santri) rather than living
 * under /api/v1/master-data/**, since spec section 6 treats "Data Santri"
 * as its own top-level module, not generic Admin configuration. */
export const santriAdapter: MasterDataAdapter<Santri, SantriCreateInput, SantriUpdateInput> = {
  entityLabel: "Santri",
  findMany: (schoolId) =>
    prisma.santri.findMany({ where: { schoolId, deletedAt: null }, orderBy: { fullName: "asc" } }),
  findById: (schoolId, id) => prisma.santri.findFirst({ where: { id, schoolId, deletedAt: null } }),
  create: (schoolId, data) => prisma.santri.create({ data: { ...data, schoolId } }),
  update: (schoolId, id, data) => prisma.santri.update({ where: { id, schoolId }, data }),
  softDelete: (schoolId, id) =>
    prisma.santri.update({
      where: { id, schoolId },
      data: { deletedAt: new Date(), status: "WITHDRAWN" },
    }),
};
