import type { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api-response";
import { setSessionCookies } from "@/lib/auth/cookies";
import { ValidationError } from "@/lib/errors";
import { loginSchema } from "@/lib/validation/auth";
import { login } from "@/services/AuthService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Input tidak valid.", parsed.error.flatten());
    }

    // Rate-limit key combines IP + email so one attacker can't lock out a
    // victim's account by spamming failed logins from many IPs, nor can a
    // NAT'd office network get globally rate-limited by one bad actor.
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const rateLimitKey = `${ip}:${parsed.data.email}`;

    const result = await login(parsed.data, rateLimitKey);
    await setSessionCookies(result.sessionToken, result.csrfToken);

    return apiSuccess(result.user, "Login berhasil.");
  } catch (error) {
    return handleApiError(error);
  }
}
