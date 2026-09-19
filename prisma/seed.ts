import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { ROLE_CODES } from "../constants/roles";
import { DEFAULT_BILL_TYPE_NAMES } from "./seed-data/bill-types";

const ROLE_NAMES: Record<(typeof ROLE_CODES)[number], string> = {
  ADMIN: "Administrator",
  BENDAHARA: "Bendahara",
  YAYASAN: "Yayasan",
};

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  // Global reference data — always seeded, every environment.
  for (const code of ROLE_CODES) {
    await prisma.role.upsert({
      where: { code },
      update: { name: ROLE_NAMES[code] },
      create: { code, name: ROLE_NAMES[code] },
    });
  }
  console.log(`Seeded roles: ${ROLE_CODES.join(", ")}`);

  // bill_types is tenant-scoped (schoolId), so it can't be seeded globally
  // like roles — only run this step for a specific school, once that
  // school row exists: SEED_SCHOOL_ID=<uuid> npm run db:seed
  const schoolId = process.env.SEED_SCHOOL_ID;
  if (schoolId) {
    for (const name of DEFAULT_BILL_TYPE_NAMES) {
      await prisma.billType.upsert({
        where: { schoolId_name: { schoolId, name } },
        update: {},
        create: { schoolId, name },
      });
    }
    console.log(
      `Seeded ${DEFAULT_BILL_TYPE_NAMES.length} default bill types for school ${schoolId}`,
    );
  } else {
    console.log("SEED_SCHOOL_ID not set — skipping default bill types (see docs/development.md)");
  }

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
