import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/UserRepository", () => ({
  findUserByEmail: vi.fn(),
  touchLastLogin: vi.fn(),
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkLoginRateLimit: vi.fn(() => ({ allowed: true })),
}));

import { hashPassword } from "@/lib/auth/password";
import { checkLoginRateLimit } from "@/lib/auth/rate-limit";
import { UnauthorizedError } from "@/lib/errors";
import type { UserWithRole } from "@/repositories/UserRepository";
import { findUserByEmail, touchLastLogin } from "@/repositories/UserRepository";
import { login } from "@/services/AuthService";

function buildUserFixture(overrides: Partial<UserWithRole> = {}): UserWithRole {
  const now = new Date();
  return {
    id: "u1",
    schoolId: "s1",
    roleId: "r1",
    fullName: "Budi Bendahara",
    email: "bendahara@sikep.test",
    passwordHash: "",
    isActive: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    role: { id: "r1", code: "BENDAHARA", name: "Bendahara", createdAt: now, updatedAt: now },
    ...overrides,
  };
}

describe("services/AuthService.login", () => {
  beforeEach(() => {
    vi.mocked(findUserByEmail).mockReset();
    vi.mocked(touchLastLogin).mockReset();
    vi.mocked(checkLoginRateLimit).mockReset().mockReturnValue({ allowed: true });
  });

  it("rejects with a generic message when the email doesn't exist (no user enumeration)", async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(null);
    await expect(login({ email: "ghost@sikep.test", password: "x" }, "key")).rejects.toThrow(
      "Email atau password salah.",
    );
  });

  it("rejects with the same generic message for a disabled account", async () => {
    const passwordHash = await hashPassword("benar123");
    vi.mocked(findUserByEmail).mockResolvedValue(
      buildUserFixture({ passwordHash, isActive: false }),
    );
    await expect(
      login({ email: "bendahara@sikep.test", password: "benar123" }, "key"),
    ).rejects.toThrow("Email atau password salah.");
  });

  it("rejects with the same generic message for a wrong password", async () => {
    const passwordHash = await hashPassword("benar123");
    vi.mocked(findUserByEmail).mockResolvedValue(buildUserFixture({ passwordHash }));
    await expect(
      login({ email: "bendahara@sikep.test", password: "salah-password" }, "key"),
    ).rejects.toThrow("Email atau password salah.");
  });

  it("returns a session token, CSRF token, and the user's role for correct credentials", async () => {
    const passwordHash = await hashPassword("benar123");
    vi.mocked(findUserByEmail).mockResolvedValue(buildUserFixture({ passwordHash }));

    const result = await login({ email: "bendahara@sikep.test", password: "benar123" }, "key");

    expect(result.user.roleCode).toBe("BENDAHARA");
    expect(result.user.schoolId).toBe("s1");
    expect(typeof result.sessionToken).toBe("string");
    expect(result.csrfToken).toHaveLength(64);
    expect(touchLastLogin).toHaveBeenCalledWith("u1");
  });

  it("rejects immediately when rate-limited, without querying the repository", async () => {
    vi.mocked(checkLoginRateLimit).mockReturnValue({ allowed: false, retryAfterSeconds: 42 });
    await expect(
      login({ email: "bendahara@sikep.test", password: "x" }, "key"),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(findUserByEmail).not.toHaveBeenCalled();
  });
});
