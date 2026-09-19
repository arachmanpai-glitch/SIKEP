import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/cookies", () => ({
  getSessionTokenFromCookies: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  verifySessionToken: vi.fn(),
}));

import { getSessionTokenFromCookies } from "@/lib/auth/cookies";
import { verifySessionToken } from "@/lib/auth/session";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { getSession, requireRole, requireSameSchool, requireSession } from "@/lib/rbac";

const samplePayload = {
  userId: "u1",
  schoolId: "school-a",
  roleCode: "BENDAHARA",
  email: "bendahara@sikep.test",
};

describe("lib/rbac", () => {
  beforeEach(() => {
    vi.mocked(getSessionTokenFromCookies).mockReset();
    vi.mocked(verifySessionToken).mockReset();
  });

  it("getSession returns null when there is no session cookie", async () => {
    vi.mocked(getSessionTokenFromCookies).mockResolvedValue(undefined);
    await expect(getSession()).resolves.toBeNull();
    expect(verifySessionToken).not.toHaveBeenCalled();
  });

  it("getSession returns the payload for a valid session token", async () => {
    vi.mocked(getSessionTokenFromCookies).mockResolvedValue("a-token");
    vi.mocked(verifySessionToken).mockResolvedValue(samplePayload);
    await expect(getSession()).resolves.toEqual(samplePayload);
  });

  it("requireSession throws UnauthorizedError when not logged in", async () => {
    vi.mocked(getSessionTokenFromCookies).mockResolvedValue(undefined);
    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("requireRole resolves the session when the role is allowed", async () => {
    vi.mocked(getSessionTokenFromCookies).mockResolvedValue("a-token");
    vi.mocked(verifySessionToken).mockResolvedValue(samplePayload);
    await expect(requireRole("BENDAHARA")).resolves.toEqual(samplePayload);
  });

  it("requireRole throws ForbiddenError when the role is not in the allowed list", async () => {
    vi.mocked(getSessionTokenFromCookies).mockResolvedValue("a-token");
    vi.mocked(verifySessionToken).mockResolvedValue(samplePayload);
    await expect(requireRole("ADMIN", "YAYASAN")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requireSameSchool passes silently for a matching schoolId", () => {
    expect(() => requireSameSchool(samplePayload, "school-a")).not.toThrow();
  });

  it("requireSameSchool throws ForbiddenError for a cross-tenant schoolId (IDOR guard)", () => {
    expect(() => requireSameSchool(samplePayload, "school-b")).toThrow(ForbiddenError);
  });
});
