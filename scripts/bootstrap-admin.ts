import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../lib/auth/password";

/**
 * One-off production bootstrap: creates the first school + ADMIN user.
 * There is no self-registration flow (spec section 3 — only 3 fixed
 * roles, users are created by an existing ADMIN via /admin/users), so the
 * very first ADMIN has to be inserted directly — see docs/development.md.
 * Refuses to run if a school already exists, so it's safe to re-run by
 * mistake.
 *
 * Usage:
 *   DATABASE_URL=<production url> \
 *   BOOTSTRAP_SCHOOL_NAME="..." \
 *   BOOTSTRAP_ADMIN_EMAIL="..." \
 *   BOOTSTRAP_ADMIN_PASSWORD="..." \
 *   npx tsx scripts/bootstrap-admin.ts
 */
async function main() {
  const schoolName = requireEnv("BOOTSTRAP_SCHOOL_NAME");
  const adminEmail = requireEnv("BOOTSTRAP_ADMIN_EMAIL");
  const adminPassword = requireEnv("BOOTSTRAP_ADMIN_PASSWORD");

  const adapter = new PrismaPg({ connectionString: requireEnv("DATABASE_URL") });
  const prisma = new PrismaClient({ adapter });

  const existing = await prisma.school.findFirst();
  if (existing) {
    console.log("A school already exists, aborting:", existing.id, existing.name);
    await prisma.$disconnect();
    return;
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });

  const school = await prisma.school.create({ data: { name: schoolName } });
  const user = await prisma.user.create({
    data: {
      schoolId: school.id,
      roleId: adminRole.id,
      fullName: "Administrator",
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
    },
  });

  console.log("Created school:", school.id, school.name);
  console.log("Created admin user:", user.id, user.email);
  await prisma.$disconnect();
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} wajib diisi.`);
  return value;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
