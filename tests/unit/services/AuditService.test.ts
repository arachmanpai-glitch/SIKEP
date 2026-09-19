import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { auditLog: { create: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/AuditService";

describe("services/AuditService.recordAudit", () => {
  beforeEach(() => {
    vi.mocked(prisma.auditLog.create).mockReset();
  });

  it("writes a row with the given action/entity/user", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await recordAudit({
      schoolId: "school-a",
      userId: "user-1",
      action: "CREATE",
      entityType: "BillType",
      entityId: "bt1",
      newValues: { name: "Syahriyah" },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId: "school-a",
        userId: "user-1",
        action: "CREATE",
        entityType: "BillType",
        entityId: "bt1",
        newValues: { name: "Syahriyah" },
      }),
    });
  });

  it("never throws when the underlying write fails (must not block the caller's mutation)", async () => {
    vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error("db down"));

    await expect(
      recordAudit({ schoolId: "s", userId: null, action: "LOGIN", entityType: "User" }),
    ).resolves.toBeUndefined();
  });
});
