import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "health" });

export interface HealthCheckResult {
  status: "ok" | "error";
  checks: {
    database: "ok" | "error";
  };
}

/**
 * Production liveness/readiness check (PHASE 12) — load balancers and
 * process managers poll this instead of a business endpoint. Kept as a
 * plain function (not a service) so `app/api/v1/health/route.ts` stays a
 * thin wrapper and this is unit-testable without spinning up a route.
 */
export async function checkHealth(): Promise<HealthCheckResult> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", checks: { database: "ok" } };
  } catch (error) {
    log.error({ err: error }, "Health check failed: database unreachable");
    return { status: "error", checks: { database: "error" } };
  }
}
