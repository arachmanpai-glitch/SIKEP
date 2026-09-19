import { ConflictError, NotFoundError } from "@/lib/errors";
import { mapPrismaError } from "@/lib/prisma-errors";
import type { SessionPayload } from "@/lib/auth/session";
import { requireSameSchool } from "@/lib/rbac";
import type { UserCreateInput, UserUpdateInput } from "@/lib/validation/user";
import {
  createUser,
  findRoleByCode,
  findUserById,
  listUsers,
  softDeleteUser,
  updateUser,
  type UserWithRole,
} from "@/repositories/UserRepository";
import { createPasswordHash } from "@/services/AuthService";
import { recordAudit } from "@/services/AuditService";

/** Public-safe shape — passwordHash never leaves this module. */
export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  roleCode: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

function toPublicUser(user: UserWithRole): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    roleCode: user.role.code,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export async function listUsersForSchool(session: SessionPayload): Promise<PublicUser[]> {
  const users = await listUsers(session.schoolId);
  return users.map(toPublicUser);
}

export async function createUserForSchool(
  session: SessionPayload,
  input: UserCreateInput,
): Promise<PublicUser> {
  const role = await findRoleByCode(input.roleCode);
  const passwordHash = await createPasswordHash(input.password);

  try {
    const user = await createUser(session.schoolId, {
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      roleId: role.id,
      isActive: input.isActive,
    });
    await recordAudit({
      schoolId: session.schoolId,
      userId: session.userId,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      newValues: toPublicUser(user),
    });
    return toPublicUser(user);
  } catch (error) {
    throw mapPrismaError(error, "User");
  }
}

export async function updateUserForSchool(
  session: SessionPayload,
  id: string,
  input: UserUpdateInput,
): Promise<PublicUser> {
  const existing = await findUserById(session.schoolId, id);
  if (!existing) {
    throw new NotFoundError("User");
  }
  requireSameSchool(session, existing.schoolId);

  if (existing.id === session.userId && input.isActive === false) {
    // A disabled admin can't re-enable themselves — locking yourself out
    // of your own account is a self-inflicted support ticket, not a
    // meaningful security boundary, so it's simplest to just disallow it.
    throw new ConflictError("Anda tidak dapat menonaktifkan akun Anda sendiri.");
  }

  const roleId = input.roleCode ? (await findRoleByCode(input.roleCode)).id : undefined;
  const passwordHash = input.password ? await createPasswordHash(input.password) : undefined;

  try {
    const updated = await updateUser(session.schoolId, id, {
      fullName: input.fullName,
      roleId,
      isActive: input.isActive,
      passwordHash,
    });
    await recordAudit({
      schoolId: session.schoolId,
      userId: session.userId,
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      oldValues: toPublicUser(existing),
      newValues: toPublicUser(updated),
    });
    return toPublicUser(updated);
  } catch (error) {
    throw mapPrismaError(error, "User");
  }
}

export async function deactivateUserForSchool(
  session: SessionPayload,
  id: string,
): Promise<PublicUser> {
  const existing = await findUserById(session.schoolId, id);
  if (!existing) {
    throw new NotFoundError("User");
  }
  requireSameSchool(session, existing.schoolId);

  if (existing.id === session.userId) {
    throw new ConflictError("Anda tidak dapat menonaktifkan akun Anda sendiri.");
  }

  const deactivated = await softDeleteUser(session.schoolId, id);
  await recordAudit({
    schoolId: session.schoolId,
    userId: session.userId,
    action: "UPDATE",
    entityType: "User",
    entityId: id,
    oldValues: toPublicUser(existing),
    newValues: toPublicUser(deactivated),
  });
  return toPublicUser(deactivated);
}
