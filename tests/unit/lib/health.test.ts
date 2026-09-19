import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

import { checkHealth } from "@/lib/health";
import { prisma } from "@/lib/prisma";

describe("lib/health.checkHealth", () => {
  beforeEach(() => {
    vi.mocked(prisma.$queryRaw).mockReset();
  });

  it("reports ok when the database responds", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);
    const result = await checkHealth();
    expect(result).toEqual({ status: "ok", checks: { database: "ok" } });
  });

  it("reports error (without throwing) when the database is unreachable", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("connection refused"));
    const result = await checkHealth();
    expect(result).toEqual({ status: "error", checks: { database: "error" } });
  });
});
