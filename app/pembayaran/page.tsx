"use client";

import Link from "next/link";
import { Fragment, type FormEvent, useEffect, useState } from "react";

import { AttachmentPanel } from "@/components/attachments/AttachmentPanel";
import { LogoutButton } from "@/components/LogoutButton";
import { apiGet, apiMutate } from "@/lib/client/api";
import { CURRENCY, LOCALE } from "@/constants/app";

const moneyFormatter = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });
const dateFormatter = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" });

interface OptionDto {
  id: string;
  name: string;
  type?: string;
  isActive?: boolean;
}

interface SantriDto {
  id: string;
  nis: string;
  fullName: string;
}

interface BillDto {
  id: string;
  santriId: string;
  billTypeId: string;
  amount: string;
  amountPaid: string;
  status: "UNPAID" | "PARTIAL" | "PAID" | "VOIDED";
  dueDate: string | null;
}

interface PaymentDto {
  id: string;
  santriId: string;
  financialAccountId: string;
  amount: string;
  paymentDate: string;
  referenceNo: string | null;
  note: string | null;
  status: string;
}

interface CreditBalanceDto {
  balance: string;
  history: { id: string; type: string; amount: string; note: string | null; createdAt: string }[];
}

const emptyForm = {
  financialAccountId: "",
  fundSourceId: "",
  categoryId: "",
  amount: "",
  paymentDate: new Date().toISOString().slice(0, 10),
  referenceNo: "",
  note: "",
};

export default function PembayaranPage() {
  const [santriList, setSantriList] = useState<SantriDto[]>([]);
  const [accounts, setAccounts] = useState<OptionDto[]>([]);
  const [fundSources, setFundSources] = useState<OptionDto[]>([]);
  const [categories, setCategories] = useState<OptionDto[]>([]);
  const [billTypes, setBillTypes] = useState<OptionDto[]>([]);

  const [santriId, setSantriId] = useState("");
  const [unpaidBills, setUnpaidBills] = useState<BillDto[]>([]);
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [creditBalance, setCreditBalance] = useState<CreditBalanceDto | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadMasterData() {
    setIsLoading(true);
    try {
      const [santriRes, accountList, fundSourceList, categoryList, billTypeList] =
        await Promise.all([
          apiGet<SantriDto[]>("/api/v1/santri"),
          apiGet<OptionDto[]>("/api/v1/master-data/financial-accounts"),
          apiGet<OptionDto[]>("/api/v1/master-data/fund-sources"),
          apiGet<OptionDto[]>("/api/v1/master-data/transaction-categories"),
          apiGet<OptionDto[]>("/api/v1/master-data/bill-types"),
        ]);
      setSantriList(santriRes);
      setAccounts(accountList.filter((a) => a.isActive !== false));
      setFundSources(fundSourceList.filter((f) => f.isActive !== false));
      setCategories(categoryList.filter((c) => c.type === "INCOME" && c.isActive !== false));
      setBillTypes(billTypeList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMasterData();
  }, []);

  async function loadSantriDetail(id: string) {
    if (!id) {
      setUnpaidBills([]);
      setPayments([]);
      setCreditBalance(null);
      return;
    }
    try {
      const [bills, paymentList, credit] = await Promise.all([
        apiGet<BillDto[]>(`/api/v1/santri-bills?santriId=${id}`),
        apiGet<PaymentDto[]>(`/api/v1/santri-payments?santriId=${id}`),
        apiGet<CreditBalanceDto>(`/api/v1/santri/${id}/credit-balance`),
      ]);
      setUnpaidBills(bills.filter((b) => b.status === "UNPAID" || b.status === "PARTIAL"));
      setPayments(paymentList);
      setCreditBalance(credit);
      setSelectedBillIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data santri.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSantriDetail(santriId);
  }, [santriId]);

  function toggleBill(id: string) {
    setSelectedBillIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function nameOf(list: OptionDto[], id: string): string {
    return list.find((o) => o.id === id)?.name ?? "(tidak dikenal)";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await apiMutate("/api/v1/santri-payments", "POST", {
        santriId,
        financialAccountId: form.financialAccountId,
        fundSourceId: form.fundSourceId,
        categoryId: form.categoryId,
        amount: form.amount,
        paymentDate: form.paymentDate,
        referenceNo: form.referenceNo || undefined,
        note: form.note || undefined,
        billIds: selectedBillIds,
      });
      setSuccessMessage(
        selectedBillIds.length > 0
          ? "Pembayaran berhasil dicatat dan dialokasikan ke tagihan yang dipilih (kelebihan otomatis jadi kredit)."
          : "Pembayaran berhasil dicatat sebagai deposit/kredit (tidak dialokasikan ke tagihan manapun).",
      );
      setForm((f) => ({ ...emptyForm, paymentDate: f.paymentDate }));
      await loadSantriDetail(santriId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencatat pembayaran.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVoid(id: string) {
    const reason = window.prompt("Alasan pembatalan?");
    if (!reason) return;
    setError(null);
    try {
      await apiMutate(`/api/v1/santri-payments/${id}/void`, "POST", { reason });
      await loadSantriDetail(santriId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membatalkan pembayaran.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Pembayaran Santri
        </h1>
        <div className="flex gap-4 text-sm">
          <Link href="/tagihan" className="underline">
            Tagihan
          </Link>
          <Link href="/dashboard" className="underline">
            Dashboard
          </Link>
          <LogoutButton />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {successMessage && (
        <p className="mt-4 text-sm text-green-700 dark:text-green-400">{successMessage}</p>
      )}

      <div className="mt-6">
        <label htmlFor="santri" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
          Pilih Santri
        </label>
        <select
          id="santri"
          value={santriId}
          onChange={(e) => setSantriId(e.target.value)}
          disabled={isLoading}
          className="w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Pilih santri...</option>
          {santriList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName} ({s.nis})
            </option>
          ))}
        </select>
      </div>

      {santriId && (
        <>
          {creditBalance && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Saldo kredit saat ini:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {moneyFormatter.format(Number(creditBalance.balance))}
              </span>
            </p>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-4 grid grid-cols-1 gap-4 rounded-md border border-zinc-200 p-4 sm:grid-cols-2 dark:border-zinc-800"
          >
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
                Alokasikan ke Tagihan (opsional — kosongkan untuk deposit/kredit)
              </label>
              {unpaidBills.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Tidak ada tagihan belum lunas untuk santri ini.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-300 p-2 dark:border-zinc-700">
                  {unpaidBills.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 py-0.5 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedBillIds.includes(b.id)}
                        onChange={() => toggleBill(b.id)}
                      />
                      {nameOf(billTypes, b.billTypeId)} — Sisa{" "}
                      {moneyFormatter.format(Number(b.amount) - Number(b.amountPaid))}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="account"
                className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300"
              >
                Akun Keuangan *
              </label>
              <select
                id="account"
                required
                value={form.financialAccountId}
                onChange={(e) => setForm((f) => ({ ...f, financialAccountId: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Pilih akun...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="fundSource"
                className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300"
              >
                Sumber Dana *
              </label>
              <select
                id="fundSource"
                required
                value={form.fundSourceId}
                onChange={(e) => setForm((f) => ({ ...f, fundSourceId: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Pilih sumber dana...</option>
                {fundSources.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="category"
                className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300"
              >
                Kategori *
              </label>
              <select
                id="category"
                required
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Pilih kategori...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="amount"
                className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300"
              >
                Jumlah (Rp) *
              </label>
              <input
                id="amount"
                required
                placeholder="500000.00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label
                htmlFor="paymentDate"
                className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300"
              >
                Tanggal *
              </label>
              <input
                id="paymentDate"
                type="date"
                required
                value={form.paymentDate}
                onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label
                htmlFor="referenceNo"
                className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300"
              >
                No. Referensi
              </label>
              <input
                id="referenceNo"
                value={form.referenceNo}
                onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
              >
                {isSubmitting ? "Menyimpan..." : "Catat Pembayaran"}
              </button>
            </div>
          </form>

          <div className="mt-8">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Riwayat Pembayaran
            </h2>
            {payments.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Belum ada pembayaran.</p>
            ) : (
              <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                    <th className="py-2 pr-4 font-medium text-zinc-500">Tanggal</th>
                    <th className="py-2 pr-4 text-right font-medium text-zinc-500">Jumlah</th>
                    <th className="py-2 pr-4 font-medium text-zinc-500">Referensi</th>
                    <th className="py-2 pr-4 font-medium text-zinc-500">Status</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <Fragment key={p.id}>
                      <tr className="border-b border-zinc-100 dark:border-zinc-900">
                        <td className="py-2 pr-4">
                          {dateFormatter.format(new Date(p.paymentDate))}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {moneyFormatter.format(Number(p.amount))}
                        </td>
                        <td className="py-2 pr-4">{p.referenceNo ?? "-"}</td>
                        <td className="py-2 pr-4">
                          <span
                            className={
                              p.status === "POSTED"
                                ? "text-green-700 dark:text-green-400"
                                : "text-zinc-500 line-through"
                            }
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                              className="text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                            >
                              Lampiran
                            </button>
                            {p.status === "POSTED" && (
                              <button
                                type="button"
                                onClick={() => void handleVoid(p.id)}
                                className="text-xs text-red-600 hover:underline dark:text-red-400"
                              >
                                Batalkan
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedId === p.id && (
                        <tr className="border-b border-zinc-100 dark:border-zinc-900">
                          <td colSpan={5} className="bg-zinc-50 py-2 pr-4 dark:bg-zinc-950">
                            <AttachmentPanel entityType="SANTRI_PAYMENT" entityId={p.id} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
