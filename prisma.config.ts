import "dotenv/config";

import { defineConfig, env } from "prisma/config";

// Prisma ORM v7: connection URL for the CLI (migrate/studio/db pull) lives
// here, not in schema.prisma's datasource block. Runtime connections (used
// by PrismaClient in lib/prisma.ts) are configured separately via a driver
// adapter, per https://pris.ly/d/prisma7-client-config.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
