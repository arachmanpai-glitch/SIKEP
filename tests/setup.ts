// Vitest global setup. Provides a minimal valid env so modules importing
// lib/env.ts don't throw during unrelated unit tests.
process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/sikep_test";
process.env.APP_URL ??= "http://localhost:3000";
// Fixed, clearly-fake test-only value — never used outside the test runner.
process.env.AUTH_SECRET ??= "test-only-auth-secret-do-not-use-in-production-00000";
