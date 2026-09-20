import type { PrismaClient } from "@prisma/client";

import { ROLE_CODES } from "@/constants/roles";
import { hashPassword } from "@/lib/auth/password";

/**
 * Fixed, clearly-fake test-only credentials — never used outside the E2E
 * database this seeds (see docs/decisions.md D81).
 *
 * Several BENDAHARA logins, not one shared account: login rate limiting
 * (`lib/auth/rate-limit.ts`, D19) keys on IP+email, and every request from
 * this suite shares the same "unknown" IP (no `x-forwarded-for` locally) —
 * so a single BENDAHARA identity reused across every spec file would trip
 * the real 5-attempts/15-minutes limit partway through a full run. Each
 * spec below gets its own identity purely to stay under that budget; it
 * is not testing anything role-specific about having several Bendahara.
 */
export const E2E_USERS = {
  ADMIN: { email: "admin@e2e.sikep.test", password: "E2eAdmin#12345", fullName: "E2E Admin" },
  YAYASAN: {
    email: "yayasan@e2e.sikep.test",
    password: "E2eYayasan#12345",
    fullName: "E2E Yayasan",
  },
  BENDAHARA_AUTH: {
    email: "bendahara-auth@e2e.sikep.test",
    password: "E2eBendahara#12345",
    fullName: "E2E Bendahara (auth)",
  },
  BENDAHARA_INCOME: {
    email: "bendahara-income@e2e.sikep.test",
    password: "E2eBendahara#12345",
    fullName: "E2E Bendahara (income)",
  },
  BENDAHARA_EXPENSE: {
    email: "bendahara-expense@e2e.sikep.test",
    password: "E2eBendahara#12345",
    fullName: "E2E Bendahara (expense)",
  },
  BENDAHARA_ATTACHMENT: {
    email: "bendahara-attachment@e2e.sikep.test",
    password: "E2eBendahara#12345",
    fullName: "E2E Bendahara (attachment)",
  },
} as const;

const USER_ROLE: Record<keyof typeof E2E_USERS, (typeof ROLE_CODES)[number]> = {
  ADMIN: "ADMIN",
  YAYASAN: "YAYASAN",
  BENDAHARA_AUTH: "BENDAHARA",
  BENDAHARA_INCOME: "BENDAHARA",
  BENDAHARA_EXPENSE: "BENDAHARA",
  BENDAHARA_ATTACHMENT: "BENDAHARA",
};

export const E2E_FIXTURES = {
  schoolName: "SIKEP E2E Test School",
  financialAccountName: "Kas Utama E2E",
  fundSourceName: "Donasi E2E",
  incomeCategoryName: "Donasi E2E",
  expenseCategoryName: "Operasional E2E",
} as const;

const ROLE_NAMES: Record<(typeof ROLE_CODES)[number], string> = {
  ADMIN: "Administrator",
  BENDAHARA: "Bendahara",
  YAYASAN: "Yayasan",
};

/**
 * Deterministic, idempotent E2E fixture. `TRUNCATE ... CASCADE` from
 * `schools` lets Postgres follow the FK graph itself and wipe every
 * dependent row — cheaper and less error-prone than hand-listing all 26
 * tables, and immune to missing a table if the schema grows. Safe to run
 * repeatedly: every run starts from a clean slate. Never touches the
 * manually-seeded local `sikep` dev database (a separate database
 * entirely, see tests/e2e/db.ts) — this is the deliberate boundary that
 * keeps E2E runs from corrupting or depending on hand-curated dev data.
 */
export async function seedE2eDatabase(prisma: PrismaClient): Promise<void> {
  for (const code of ROLE_CODES) {
    await prisma.role.upsert({
      where: { code },
      update: { name: ROLE_NAMES[code] },
      create: { code, name: ROLE_NAMES[code] },
    });
  }

  // Fixed literal table name, never user input — TRUNCATE has no
  // parameterized-identifier form in any SQL dialect, so $executeRawUnsafe
  // is the correct tool here, not a shortcut around parameterization.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "schools" CASCADE');

  const school = await prisma.school.create({ data: { name: E2E_FIXTURES.schoolName } });

  const roles = await prisma.role.findMany();
  const roleIdByCode = new Map(roles.map((r) => [r.code, r.id]));

  for (const key of Object.keys(E2E_USERS) as (keyof typeof E2E_USERS)[]) {
    const fixture = E2E_USERS[key];
    const roleId = roleIdByCode.get(USER_ROLE[key]);
    if (!roleId) {
      throw new Error(`Role ${USER_ROLE[key]} tidak ditemukan setelah upsert — seharusnya tidak terjadi.`);
    }

    await prisma.user.create({
      data: {
        schoolId: school.id,
        roleId,
        fullName: fixture.fullName,
        email: fixture.email,
        passwordHash: await hashPassword(fixture.password),
      },
    });
  }

  await prisma.financialAccount.create({
    data: {
      schoolId: school.id,
      name: E2E_FIXTURES.financialAccountName,
      type: "CASH",
      // Real starting balance so expense-approval.spec.ts's above-threshold
      // expense has enough to post against regardless of what order specs
      // run in (each spec file must stand alone financially, not depend
      // on income another spec happened to record first).
      openingBalance: "10000000.00",
    },
  });

  await prisma.fundSource.create({
    data: { schoolId: school.id, name: E2E_FIXTURES.fundSourceName },
  });

  await prisma.transactionCategory.create({
    data: { schoolId: school.id, name: E2E_FIXTURES.incomeCategoryName, type: "INCOME" },
  });

  await prisma.transactionCategory.create({
    data: { schoolId: school.id, name: E2E_FIXTURES.expenseCategoryName, type: "EXPENSE" },
  });
}
