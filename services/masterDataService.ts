import type { AuditAction } from "@prisma/client";

import { NotFoundError } from "@/lib/errors";
import { mapPrismaError } from "@/lib/prisma-errors";
import type { SessionPayload } from "@/lib/auth/session";
import { requireSameSchool } from "@/lib/rbac";
import { recordAudit } from "@/services/AuditService";

/**
 * Six of SIKEP's master-data tables (academic_years, classes,
 * financial_accounts, fund_sources, transaction_categories, bill_types)
 * are structurally identical from the service layer's point of view: a
 * tenant-scoped, soft-deletable list a Admin can CRUD, with every mutation
 * audited. Rather than duplicate that orchestration 6 times, each entity
 * implements this narrow adapter (the actual Prisma calls, which ARE
 * genuinely different per model) and gets the shared list/create/update/
 * remove behavior for free. Santri and User are NOT wired through this —
 * their business rules diverge enough (class/status, role/password) to
 * warrant dedicated services.
 */
export interface MasterDataRecord {
  id: string;
  schoolId: string;
}

export interface MasterDataAdapter<TRecord extends MasterDataRecord, TCreate, TUpdate> {
  /** Matches audit_logs.entity_type and NotFoundError's entity label. */
  entityLabel: string;
  findMany(schoolId: string): Promise<TRecord[]>;
  findById(schoolId: string, id: string): Promise<TRecord | null>;
  create(schoolId: string, data: TCreate): Promise<TRecord>;
  update(schoolId: string, id: string, data: TUpdate): Promise<TRecord>;
  softDelete(schoolId: string, id: string): Promise<TRecord>;
}

export interface MasterDataService<TRecord extends MasterDataRecord, TCreate, TUpdate> {
  list(session: SessionPayload): Promise<TRecord[]>;
  create(session: SessionPayload, data: TCreate): Promise<TRecord>;
  update(session: SessionPayload, id: string, data: TUpdate): Promise<TRecord>;
  remove(session: SessionPayload, id: string): Promise<TRecord>;
}

async function loadOwned<TRecord extends MasterDataRecord, TCreate, TUpdate>(
  adapter: MasterDataAdapter<TRecord, TCreate, TUpdate>,
  session: SessionPayload,
  id: string,
): Promise<TRecord> {
  const existing = await adapter.findById(session.schoolId, id);
  if (!existing) {
    throw new NotFoundError(adapter.entityLabel);
  }
  // Redundant with the schoolId filter already inside findById, kept as an
  // explicit, always-called invariant rather than an implicit assumption —
  // see lib/rbac.ts requireSameSchool.
  requireSameSchool(session, existing.schoolId);
  return existing;
}

async function audit(
  session: SessionPayload,
  action: AuditAction,
  entityType: string,
  entityId: string,
  oldValues: unknown,
  newValues: unknown,
): Promise<void> {
  await recordAudit({
    schoolId: session.schoolId,
    userId: session.userId,
    action,
    entityType,
    entityId,
    oldValues,
    newValues,
  });
}

export function createMasterDataService<TRecord extends MasterDataRecord, TCreate, TUpdate>(
  adapter: MasterDataAdapter<TRecord, TCreate, TUpdate>,
): MasterDataService<TRecord, TCreate, TUpdate> {
  return {
    async list(session) {
      return adapter.findMany(session.schoolId);
    },

    async create(session, data) {
      try {
        const record = await adapter.create(session.schoolId, data);
        await audit(session, "CREATE", adapter.entityLabel, record.id, null, record);
        return record;
      } catch (error) {
        throw mapPrismaError(error, adapter.entityLabel);
      }
    },

    async update(session, id, data) {
      const existing = await loadOwned(adapter, session, id);
      try {
        const updated = await adapter.update(session.schoolId, id, data);
        await audit(session, "UPDATE", adapter.entityLabel, id, existing, updated);
        return updated;
      } catch (error) {
        throw mapPrismaError(error, adapter.entityLabel);
      }
    },

    async remove(session, id) {
      const existing = await loadOwned(adapter, session, id);
      const deleted = await adapter.softDelete(session.schoolId, id);
      await audit(session, "UPDATE", adapter.entityLabel, id, existing, deleted);
      return deleted;
    },
  };
}
