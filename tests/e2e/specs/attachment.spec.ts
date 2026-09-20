import path from "node:path";

import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

import { loginAs } from "../helpers";
import { E2E_FIXTURES, E2E_USERS } from "../seed";

const AMOUNT = "271821.00";
const FIXTURE_FILE = path.join(__dirname, "..", "fixtures", "bukti-test.pdf");

/**
 * Closes the verification gap a plain browser-automation tool can't: a
 * real `<input type="file">` upload (setInputFiles uses CDP, not a
 * simulated click, so it works even though the input is visually hidden —
 * see components/attachments/AttachmentPanel.tsx) through the actual
 * "Bukti Transaksi" UI, end to end to a real signed-URL download.
 */
test("Bendahara mengunggah Bukti Transaksi lewat form sungguhan dan bisa mengunduhnya kembali", async ({
  page,
}) => {
  await loginAs(page, E2E_USERS.BENDAHARA_ATTACHMENT);
  await page.goto("/pemasukan");

  await page.getByLabel(/Akun Keuangan/).selectOption({ label: E2E_FIXTURES.financialAccountName });
  await page.getByLabel(/Sumber Dana/).selectOption({ label: E2E_FIXTURES.fundSourceName });
  await page.getByLabel(/Kategori/).selectOption({ label: E2E_FIXTURES.incomeCategoryName });
  await page.getByLabel(/Jumlah \(Rp\)/).fill(AMOUNT);
  await page.getByRole("button", { name: "Catat Pemasukan" }).click();

  const row = page.locator("tr", { hasText: /271\.821/ });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Lampiran" }).click();

  await expect(page.getByText("Belum ada lampiran.")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(FIXTURE_FILE);

  const fileLink = page.getByRole("button", { name: "bukti-test.pdf" });
  await expect(fileLink).toBeVisible();

  const downloadPromise = page.context().waitForEvent("download");
  await fileLink.click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("bukti-test.pdf");
  const downloadedPath = await download.path();
  expect(downloadedPath).toBeTruthy();

  const [downloaded, original] = await Promise.all([
    readFile(downloadedPath as string),
    readFile(FIXTURE_FILE),
  ]);
  expect(downloaded.equals(original)).toBe(true);
});
