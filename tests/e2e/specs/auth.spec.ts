import { expect, test } from "@playwright/test";

import { loginAs, logout } from "../helpers";
import { E2E_USERS } from "../seed";

test.describe("Auth (login sungguhan di browser)", () => {
  test("BENDAHARA berhasil login dan diarahkan ke halaman utama", async ({ page }) => {
    await loginAs(page, E2E_USERS.BENDAHARA_AUTH);

    await expect(page).toHaveURL("/");
    await expect(page.getByText(E2E_USERS.BENDAHARA_AUTH.email)).toBeVisible();
    await expect(page.getByText("(BENDAHARA)")).toBeVisible();
  });

  test("password salah menampilkan error dan tetap di halaman login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(E2E_USERS.BENDAHARA_AUTH.email);
    await page.getByLabel("Password").fill("password-yang-salah-sekali");
    await page.getByRole("button", { name: "Masuk" }).click();

    // Scoped past `getByRole("alert")` alone: Next.js's own hidden route
    // announcer (`#__next-route-announcer__`) also has role="alert" and
    // would otherwise make this locator ambiguous.
    await expect(page.getByText("Email atau password salah.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout menghapus sesi — halaman terproteksi redirect balik ke /login", async ({ page }) => {
    await loginAs(page, E2E_USERS.ADMIN);
    await expect(page).toHaveURL("/");

    await logout(page);
    await expect(page).toHaveURL("/login");

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  });
});
