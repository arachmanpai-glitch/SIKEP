import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { clearSessionCookies } from "@/lib/auth/cookies";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { logger } from "@/lib/logger";
import { requireSession } from "@/lib/rbac";

const log = logger.child({ module: "AuthRoute" });

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requireCsrf(request);
    await clearSessionCookies();
    log.info({ userId: session.userId }, "User logged out");

    return apiSuccess(null, "Logout berhasil.");
  } catch (error) {
    return handleApiError(error);
  }
}
