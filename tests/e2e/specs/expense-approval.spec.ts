import { expect, test } from "@playwright/test";

import { loginAs, logout } from "../helpers";
import { E2E_FIXTURES, E2E_USERS } from "../seed";

// Above the default expense_approval_threshold (Rp 1.000.000,
// ApprovalSettingsRepository.getOrCreateApprovalSettings) so this
// deliberately routes through PENDING_APPROVAL instead of posting
// straight to the ledger.
const AMOUNT = "1543210.00";
const DESCRIPTION = "E2E expense approval test";

/**
 * The one scenario no other test layer in this repo can cover: a real
 * BENDAHARA session submits an expense in one browser context, then a
 * separate real YAYASAN session approves it in another — proving the
 * cross-role approval handoff works end-to-end, not just that each
 * service function is individually correct (tests/integration/*.test.ts
 * already covers that with a mocked-but-stateful repository layer).
 */
test("Bendahara mengajukan pengeluaran di atas ambang batas, Yayasan menyetujui, status jadi POSTED", async ({
  page,
}) => {
  await loginAs(page, E2E_USERS.BENDAHARA_EXPENSE);
  await page.goto("/pengeluaran");

  await page.getByLabel(/Akun Keuangan/).selectOption({ label: E2E_FIXTURES.financialAccountName });
  await page.getByLabel(/Kategori/).selectOption({ label: E2E_FIXTURES.expenseCategoryName });
  await page.getByLabel(/Jumlah \(Rp\)/).fill(AMOUNT);
  await page.getByLabel("Keterangan").fill(DESCRIPTION);
  await page.getByRole("button", { name: "Catat Pengeluaran" }).click();

  const pendingRow = page.locator("tr", { hasText: /1\.543\.210/ });
  await expect(pendingRow).toBeVisible();
  await expect(pendingRow.getByText("MENUNGGU APPROVAL")).toBeVisible();

  await logout(page);
  await loginAs(page, E2E_USERS.YAYASAN);
  await page.goto("/persetujuan");

  const pendingItem = page.locator("li", { hasText: DESCRIPTION });
  await expect(pendingItem).toBeVisible();
  await pendingItem.getByRole("button", { name: "Setujui" }).click();

  await expect(page.getByText(/disetujui dan telah diposting/i)).toBeVisible();
  await expect(pendingItem).not.toBeVisible();

  await logout(page);
  await loginAs(page, E2E_USERS.BENDAHARA_EXPENSE);
  await page.goto("/pengeluaran");

  const postedRow = page.locator("tr", { hasText: /1\.543\.210/ });
  await expect(postedRow.getByText("POSTED")).toBeVisible();
});
