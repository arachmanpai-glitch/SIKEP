import type { SessionPayload } from "@/lib/auth/session";
import type { ApprovalSettingsUpdateInput } from "@/lib/validation/settings";
import {
  getOrCreateApprovalSettings,
  updateApprovalSettings,
} from "@/repositories/ApprovalSettingsRepository";
import { recordAudit } from "@/services/AuditService";

export async function getApprovalSettingsForSchool(session: SessionPayload) {
  return getOrCreateApprovalSettings(session.schoolId);
}

export async function updateApprovalSettingsForSchool(
  session: SessionPayload,
  input: ApprovalSettingsUpdateInput,
) {
  const before = await getOrCreateApprovalSettings(session.schoolId);
  const after = await updateApprovalSettings(session.schoolId, {
    ...input,
    updatedById: session.userId,
  });

  // CONFIG_CHANGE (not UPDATE) — spec section 16 lists it as its own
  // audited action distinct from ordinary entity edits, because changing
  // the approval threshold / negative-balance policy affects every future
  // transaction, not just one record.
  await recordAudit({
    schoolId: session.schoolId,
    userId: session.userId,
    action: "CONFIG_CHANGE",
    entityType: "ApprovalSettings",
    entityId: after.id,
    oldValues: before,
    newValues: after,
  });

  return after;
}
