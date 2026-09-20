import { expect, test } from "@playwright/test";

import { loginAs } from "../helpers";
import { E2E_FIXTURES, E2E_USERS } from "../seed";

// Distinctive amount so this test's row is unambiguous among whatever
// other rows the shared E2E database accumulates during the run.
const AMOUNT = "813275.00";

test("BENDAHARA mencatat pemasukan lewat form sungguhan dan langsung POSTED", async ({ page }) => {
  await loginAs(page, E2E_USERS.BENDAHARA_INCOME);
  await page.goto("/pemasukan");

  await page.getByLabel(/Akun Keuangan/).selectOption({ label: E2E_FIXTURES.financialAccountName });
  await page.getByLabel(/Sumber Dana/).selectOption({ label: E2E_FIXTURES.fundSourceName });
  await page.getByLabel(/Kategori/).selectOption({ label: E2E_FIXTURES.incomeCategoryName });
  await page.getByLabel(/Jumlah \(Rp\)/).fill(AMOUNT);
  await page.getByLabel("Keterangan").fill("E2E income test");

  await page.getByRole("button", { name: "Catat Pemasukan" }).click();

  const row = page.locator("tr", { hasText: /813\.275/ });
  await expect(row).toBeVisible();
  await expect(row.getByText("POSTED")).toBeVisible();
});
