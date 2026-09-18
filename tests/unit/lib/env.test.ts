import { describe, expect, it } from "vitest";

describe("lib/env", () => {
  it("loads successfully with a valid DATABASE_URL from test setup", async () => {
    const { env } = await import("@/lib/env");
    expect(env.DATABASE_URL).toContain("postgresql://");
    expect(env.APP_TIMEZONE).toBe("Asia/Jakarta");
    expect(env.NODE_ENV).toBe("test");
  });
});
