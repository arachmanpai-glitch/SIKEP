import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { requireCsrf } from "@/lib/auth/require-csrf";
import { ValidationError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { userCreateSchema } from "@/lib/validation/user";
import { createUserForSchool, listUsersForSchool } from "@/services/UserService";

export async function GET() {
  try {
    // User management is Admin-only (spec section 2/3).
    const session = await requireRole("ADMIN");
    const users = await listUsersForSchool(session);
    return apiSuccess(users);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("ADMIN");
    await requireCsrf(request);

    const body = await request.json().catch(() => null);
    const parsed = userCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    const user = await createUserForSchool(session, parsed.data);
    return apiSuccess(user, "User berhasil dibuat.", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
