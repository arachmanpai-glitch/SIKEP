import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/UserRepository", () => ({
  listUsers: vi.fn(),
  findUserById: vi.fn(),
  findRoleByCode: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  softDeleteUser: vi.fn(),
}));
vi.mock("@/services/AuthService", () => ({
  createPasswordHash: vi.fn(async (pw: string) => `hashed:${pw}`),
}));
vi.mock("@/services/AuditService", () => ({
  recordAudit: vi.fn(),
}));

import { ConflictError, NotFoundError } from "@/lib/errors";
import {
  createUser,
  findRoleByCode,
  findUserById,
  softDeleteUser,
  updateUser,
  type UserWithRole,
} from "@/repositories/UserRepository";
import { recordAudit } from "@/services/AuditService";
import {
  createUserForSchool,
  deactivateUserForSchool,
  updateUserForSchool,
} from "@/services/UserService";

const SESSION = {
  userId: "admin-1",
  schoolId: "school-a",
  roleCode: "ADMIN",
  email: "admin@sikep.test",
};

function userFixture(overrides: Partial<UserWithRole> = {}): UserWithRole {
  const now = new Date();
  return {
    id: "u1",
    schoolId: "school-a",
    roleId: "role-bendahara",
    fullName: "Budi",
    email: "budi@sikep.test",
    passwordHash: "existing-hash",
    isActive: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    role: {
      id: "role-bendahara",
      code: "BENDAHARA",
      name: "Bendahara",
      createdAt: now,
      updatedAt: now,
    },
    ...overrides,
  };
}

describe("services/UserService", () => {
  beforeEach(() => {
    vi.mocked(findRoleByCode).mockReset();
    vi.mocked(createUser).mockReset();
    vi.mocked(findUserById).mockReset();
    vi.mocked(updateUser).mockReset();
    vi.mocked(softDeleteUser).mockReset();
    vi.mocked(recordAudit).mockReset();
  });

  it("createUserForSchool hashes the password and never returns it in the public shape", async () => {
    vi.mocked(findRoleByCode).mockResolvedValue({
      id: "role-bendahara",
      code: "BENDAHARA",
      name: "Bendahara",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(createUser).mockResolvedValue(userFixture());

    const result = await createUserForSchool(SESSION, {
      fullName: "Budi",
      email: "budi@sikep.test",
      password: "plaintext-password",
      roleCode: "BENDAHARA",
    });

    expect(createUser).toHaveBeenCalledWith(
      "school-a",
      expect.objectContaining({ passwordHash: "hashed:plaintext-password" }),
    );
    expect(result).not.toHaveProperty("passwordHash");
    expect(result.roleCode).toBe("BENDAHARA");
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entityType: "User" }),
    );
  });

  it("createUserForSchool maps a duplicate email into ConflictError", async () => {
    vi.mocked(findRoleByCode).mockResolvedValue({
      id: "role-bendahara",
      code: "BENDAHARA",
      name: "Bendahara",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { Prisma } = await import("@prisma/client");
    vi.mocked(createUser).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "7.10.0" }),
    );

    await expect(
      createUserForSchool(SESSION, {
        fullName: "Budi",
        email: "budi@sikep.test",
        password: "plaintext-password",
        roleCode: "BENDAHARA",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("updateUserForSchool throws NotFoundError for a nonexistent user", async () => {
    vi.mocked(findUserById).mockResolvedValue(null);
    await expect(updateUserForSchool(SESSION, "ghost", { fullName: "x" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("updateUserForSchool refuses to let an Admin deactivate their own account", async () => {
    vi.mocked(findUserById).mockResolvedValue(userFixture({ id: SESSION.userId }));
    await expect(
      updateUserForSchool(SESSION, SESSION.userId, { isActive: false }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("deactivateUserForSchool refuses to let an Admin deactivate their own account", async () => {
    vi.mocked(findUserById).mockResolvedValue(userFixture({ id: SESSION.userId }));
    await expect(deactivateUserForSchool(SESSION, SESSION.userId)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("deactivateUserForSchool soft-deletes another user and audits it", async () => {
    const target = userFixture({ id: "u2" });
    vi.mocked(findUserById).mockResolvedValue(target);
    vi.mocked(softDeleteUser).mockResolvedValue({ ...target, isActive: false });

    const result = await deactivateUserForSchool(SESSION, "u2");

    expect(result.isActive).toBe(false);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE", entityType: "User" }),
    );
  });
});
