import { generateCsrfToken } from "@/lib/auth/csrf";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { checkLoginRateLimit } from "@/lib/auth/rate-limit";
import { createSessionToken, type SessionPayload } from "@/lib/auth/session";
import { UnauthorizedError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { LoginInput } from "@/lib/validation/auth";
import { findUserByEmail, touchLastLogin } from "@/repositories/UserRepository";

const log = logger.child({ module: "AuthService" });

/**
 * Precomputed Argon2id hash of an arbitrary, never-used password. When the
 * looked-up email doesn't exist (or the account is disabled), we still run
 * a verify() against this so a non-existent-email request takes roughly
 * the same time as a wrong-password request — otherwise the fast path
 * (skip hashing entirely) leaks via response timing whether an email is
 * registered (a standard login-flow side channel). See docs/decisions.md D20.
 */
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$Irc0eq+ThSAtMwrQIZ4Gxg$H+cKLDlmGrDYypiErmnFS1WMEHggm30AhF5Fcw9DdiY";

export interface LoginResult {
  sessionToken: string;
  csrfToken: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    roleCode: string;
    schoolId: string;
  };
}

export async function login(input: LoginInput, rateLimitKey: string): Promise<LoginResult> {
  const rateLimit = checkLoginRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    throw new UnauthorizedError(
      `Terlalu banyak percobaan login. Coba lagi dalam ${rateLimit.retryAfterSeconds} detik.`,
    );
  }

  const user = await findUserByEmail(input.email);

  if (!user || !user.isActive) {
    // Same generic message and same Argon2id cost as a real wrong-password
    // check — deliberately does not distinguish "no such email" from
    // "wrong password" from "account disabled" (avoids user enumeration).
    await verifyPassword(DUMMY_PASSWORD_HASH, input.password);
    throw new UnauthorizedError("Email atau password salah.");
  }

  const passwordOk = await verifyPassword(user.passwordHash, input.password);
  if (!passwordOk) {
    throw new UnauthorizedError("Email atau password salah.");
  }

  const sessionPayload: SessionPayload = {
    userId: user.id,
    schoolId: user.schoolId,
    roleCode: user.role.code,
    email: user.email,
  };

  const [sessionToken] = await Promise.all([
    createSessionToken(sessionPayload),
    touchLastLogin(user.id),
  ]);
  const csrfToken = generateCsrfToken();

  log.info({ userId: user.id }, "User logged in");

  return {
    sessionToken,
    csrfToken,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roleCode: user.role.code,
      schoolId: user.schoolId,
    },
  };
}

/** Used only by PHASE 4 user-management and prisma/seed.ts — kept here so
 * every password hash in the system goes through the same policy. */
export async function createPasswordHash(plainPassword: string): Promise<string> {
  return hashPassword(plainPassword);
}
