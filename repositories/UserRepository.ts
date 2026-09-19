import type { Role, User } from "@prisma/client";

import type { RoleCode } from "@/constants/roles";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export type UserWithRole = User & { role: Role };

/** Soft-deleted users (`deletedAt`) never surface here — same as not existing. */
export async function findUserByEmail(email: string): Promise<UserWithRole | null> {
  return prisma.user.findFirst({
    where: { email, deletedAt: null },
    include: { role: true },
  });
}

export async function touchLastLogin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}

export async function listUsers(schoolId: string): Promise<UserWithRole[]> {
  return prisma.user.findMany({
    where: { schoolId, deletedAt: null },
    include: { role: true },
    orderBy: { fullName: "asc" },
  });
}

export async function findUserById(schoolId: string, id: string): Promise<UserWithRole | null> {
  return prisma.user.findFirst({
    where: { id, schoolId, deletedAt: null },
    include: { role: true },
  });
}

/** Global reference lookup (roles table is not tenant-scoped — D12). */
export async function findRoleByCode(code: RoleCode): Promise<Role> {
  const role = await prisma.role.findUnique({ where: { code } });
  if (!role) {
    // Only happens if `prisma/seed.ts` hasn't been run yet against this DB.
    throw new NotFoundError(`Role "${code}" (jalankan "npm run db:seed")`);
  }
  return role;
}

export interface CreateUserData {
  fullName: string;
  email: string;
  passwordHash: string;
  roleId: string;
  isActive?: boolean;
}

export async function createUser(schoolId: string, data: CreateUserData): Promise<UserWithRole> {
  return prisma.user.create({ data: { ...data, schoolId }, include: { role: true } });
}

export interface UpdateUserData {
  fullName?: string;
  roleId?: string;
  isActive?: boolean;
  passwordHash?: string;
}

export async function updateUser(
  schoolId: string,
  id: string,
  data: UpdateUserData,
): Promise<UserWithRole> {
  return prisma.user.update({ where: { id, schoolId }, data, include: { role: true } });
}

export async function softDeleteUser(schoolId: string, id: string): Promise<UserWithRole> {
  return prisma.user.update({
    where: { id, schoolId },
    data: { deletedAt: new Date(), isActive: false },
    include: { role: true },
  });
}
