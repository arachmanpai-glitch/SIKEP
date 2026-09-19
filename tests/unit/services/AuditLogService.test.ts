import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/AuditLogRepository", () => ({
  listAuditLogs: vi.fn(),
}));

import { listAuditLogs } from "@/repositories/AuditLogRepository";
import { listAuditLogsForSchool } from "@/services/AuditLogService";

const SESSION = {
  userId: "u1",
  schoolId: "school-a",
  roleCode: "ADMIN",
  email: "a@sikep.test",
};

describe("services/AuditLogService.listAuditLogsForSchool", () => {
  beforeEach(() => {
    vi.mocked(listAuditLogs)
      .mockReset()
      .mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 50 });
  });

  it("scopes the query to the session's school and forwards filters/pagination", async () => {
    await listAuditLogsForSchool(SESSION, {
      action: "VOID",
      entityType: "ExpenseTransaction",
      userId: "u2",
      from: new Date("2026-01-01"),
      to: new Date("2026-01-31"),
      page: 2,
      pageSize: 25,
    });

    expect(listAuditLogs).toHaveBeenCalledWith(
      "school-a",
      {
        action: "VOID",
        entityType: "ExpenseTransaction",
        userId: "u2",
        from: new Date("2026-01-01"),
        to: new Date("2026-01-31"),
      },
      2,
      25,
    );
  });
});
