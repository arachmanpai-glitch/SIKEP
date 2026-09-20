import type { Page } from "@playwright/test";

export interface E2eLoginUser {
  email: string;
  password: string;
}

/** Drives the real `/login` form — every spec starts from a real browser
 * session, never an injected cookie, so the actual login route/CSRF/RBAC
 * wiring is exercised exactly like a human would (the gap this suite
 * fills, see docs/step11/00-progress.md). */
export async function loginAs(page: Page, user: E2eLoginUser): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Clicks "Keluar" on whatever page the caller is already on — every
 * authenticated page renders its own `<LogoutButton />` (docs/decisions.md
 * D86; originally only `/` had one, a gap this suite surfaced). Doubles as
 * a regression check: if a page's header ever drops the button again, the
 * spec calling `logout()` from that page fails instead of silently
 * passing via a `page.goto("/")` fallback. */
export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Keluar" }).click();
  await page.waitForURL("/login");
}
