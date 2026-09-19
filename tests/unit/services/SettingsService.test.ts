import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/ApprovalSettingsRepository", () => ({
  getOrCreateApprovalSettings: vi.fn(),
  updateApprovalSettings: vi.fn(),
}));
vi.mock("@/services/AuditService", () => ({
  recordAudit: vi.fn(),
}));

import {
  getOrCreateApprovalSettings,
  updateApprovalSettings,
} from "@/repositories/ApprovalSettingsRepository";
import { recordAudit } from "@/services/AuditService";
import {
  getApprovalSettingsForSchool,
  updateApprovalSettingsForSchool,
} from "@/services/SettingsService";

const SESSION = {
  userId: "admin-1",
  schoolId: "school-a",
  roleCode: "ADMIN",
  email: "admin@sikep.test",
};

describe("services/SettingsService", () => {
  beforeEach(() => {
    vi.mocked(getOrCreateApprovalSettings).mockReset();
    vi.mocked(updateApprovalSettings).mockReset();
    vi.mocked(recordAudit).mockReset();
  });

  it("getApprovalSettingsForSchool returns the (lazily-created) row for the session's school", async () => {
    vi.mocked(getOrCreateApprovalSettings).mockResolvedValue({
      id: "as1",
      schoolId: "school-a",
      expenseApprovalThreshold: "1000000.00" as never,
      allowNegativeBalance: false,
      updatedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await getApprovalSettingsForSchool(SESSION);
    expect(getOrCreateApprovalSettings).toHaveBeenCalledWith("school-a");
    expect(result.schoolId).toBe("school-a");
  });

  it("updateApprovalSettingsForSchool writes a CONFIG_CHANGE audit entry (not UPDATE)", async () => {
    const before = {
      id: "as1",
      schoolId: "school-a",
      expenseApprovalThreshold: "1000000.00" as never,
      allowNegativeBalance: false,
      updatedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const after = {
      ...before,
      expenseApprovalThreshold: "2000000.00" as never,
      allowNegativeBalance: true,
    };
    vi.mocked(getOrCreateApprovalSettings).mockResolvedValue(before);
    vi.mocked(updateApprovalSettings).mockResolvedValue(after);

    const result = await updateApprovalSettingsForSchool(SESSION, {
      expenseApprovalThreshold: "2000000.00",
      allowNegativeBalance: true,
    });

    expect(result.allowNegativeBalance).toBe(true);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONFIG_CHANGE",
        entityType: "ApprovalSettings",
        oldValues: before,
        newValues: after,
      }),
    );
  });
});
