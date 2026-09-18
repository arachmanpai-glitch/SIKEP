import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";

/**
 * Singleton Prisma client. Next.js hot-reloads modules in dev, which would
 * otherwise create a new PrismaClient (and a new DB connection pool) on
 * every edit; caching it on `globalThis` avoids exhausting connections.
 *
 * Prisma ORM v7 requires a driver adapter for the runtime connection (the
 * schema's datasource block only configures the CLI, via prisma.config.ts).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
