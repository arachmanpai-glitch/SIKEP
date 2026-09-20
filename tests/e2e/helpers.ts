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

/** The "Keluar" button only exists on `/` (app/page.tsx) — no shared
 * header/nav renders it on inner pages (app/layout.tsx has none), so a
 * real user (and this helper) has to go home first to log out. Surfaced
 * by writing this suite; not fixed here since it's a UI-navigation
 * change, not part of the E2E test task. */
export async function logout(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Keluar" }).click();
  await page.waitForURL("/login");
}
