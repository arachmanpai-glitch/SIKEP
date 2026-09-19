"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

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

interface IncomeDto {
  id: string;
  financialAccountId: string;
  fundSourceId: string;
  categoryId: string;
  amount: string;
  transactionDate: string;
  description: string | null;
  status: "POSTED" | "VOIDED";
  voidReason: string | null;
}

const emptyForm = {
  financialAccountId: "",
  fundSourceId: "",
  categoryId: "",
  amount: "",
  transactionDate: new Date().toISOString().slice(0, 10),
  description: "",
};

export default function PemasukanPage() {
  const [accounts, setAccounts] = useState<OptionDto[]>([]);
  const [fundSources, setFundSources] = useState<OptionDto[]>([]);
  const [categories, setCategories] = useState<OptionDto[]>([]);
  const [records, setRecords] = useState<IncomeDto[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  async function reload() {
    setIsLoading(true);
    try {
      const [accountList, fundSourceList, categoryList, incomeList] = await Promise.all([
        apiGet<OptionDto[]>("/api/v1/master-data/financial-accounts"),
        apiGet<OptionDto[]>("/api/v1/master-data/fund-sources"),
        apiGet<OptionDto[]>("/api/v1/master-data/transaction-categories"),
        apiGet<IncomeDto[]>("/api/v1/income"),
      ]);
      setAccounts(accountList.filter((a) => a.isActive !== false));
      setFundSources(fundSourceList.filter((f) => f.isActive !== false));
      setCategories(categoryList.filter((c) => c.type === "INCOME" && c.isActive !== false));
      setRecords(incomeList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiMutate("/api/v1/income", "POST", {
        financialAccountId: form.financialAccountId,
        fundSourceId: form.fundSourceId,
        categoryId: form.categoryId,
        amount: form.amount,
        transactionDate: form.transactionDate,
        description: form.description || undefined,
      });
      setForm((f) => ({ ...emptyForm, transactionDate: f.transactionDate }));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencatat pemasukan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVoid(id: string) {
    if (!voidReason.trim()) {
      setError("Alasan pembatalan wajib diisi.");
      return;
    }
    setError(null);
    try {
      await apiMutate(`/api/v1/income/${id}/void`, "POST", { reason: voidReason });
      setVoidingId(null);
      setVoidReason("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membatalkan pemasukan.");
    }
  }

  function nameOf(list: OptionDto[], id: string): string {
    return list.find((o) => o.id === id)?.name ?? "(tidak dikenal)";
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Catat Pemasukan
        </h1>
        <Link href="/dashboard" className="text-sm underline">
          Dashboard
        </Link>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Pemasukan langsung diposting ke ledger (spec section 11 — tidak ada gerbang approval
        untuk pemasukan).
      </p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-6 grid grid-cols-1 gap-4 rounded-md border border-zinc-200 p-4 sm:grid-cols-2 dark:border-zinc-800"
      >
        <div>
          <label htmlFor="account" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
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
          <label htmlFor="fundSource" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
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
          <label htmlFor="category" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
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
          <label htmlFor="amount" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
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
            htmlFor="transactionDate"
            className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300"
          >
            Tanggal *
          </label>
          <input
            id="transactionDate"
            type="date"
            required
            value={form.transactionDate}
            onChange={(e) => setForm((f) => ({ ...f, transactionDate: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label
            htmlFor="description"
            className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300"
          >
            Keterangan
          </label>
          <input
            id="description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
          >
            {isSubmitting ? "Menyimpan..." : "Catat Pemasukan"}
          </button>
        </div>
      </form>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Riwayat Pemasukan
        </h2>
        {isLoading ? (
          <p className="mt-2 text-sm text-zinc-500">Memuat...</p>
        ) : records.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Belum ada pemasukan tercatat.</p>
        ) : (
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium text-zinc-500">Tanggal</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Akun</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Kategori</th>
                <th className="py-2 pr-4 text-right font-medium text-zinc-500">Jumlah</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Status</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4">{dateFormatter.format(new Date(r.transactionDate))}</td>
                  <td className="py-2 pr-4">{nameOf(accounts, r.financialAccountId)}</td>
                  <td className="py-2 pr-4">{nameOf(categories, r.categoryId)}</td>
                  <td className="py-2 pr-4 text-right">{moneyFormatter.format(Number(r.amount))}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={
                        r.status === "POSTED"
                          ? "text-green-700 dark:text-green-400"
                          : "text-zinc-500 line-through"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    {r.status === "POSTED" &&
                      (voidingId === r.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            placeholder="Alasan..."
                            value={voidReason}
                            onChange={(e) => setVoidReason(e.target.value)}
                            className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          />
                          <button
                            type="button"
                            onClick={() => void handleVoid(r.id)}
                            className="text-xs text-red-600 hover:underline dark:text-red-400"
                          >
                            Konfirmasi
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVoidingId(null);
                              setVoidReason("");
                            }}
                            className="text-xs text-zinc-500 hover:underline"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setVoidingId(r.id)}
                          className="text-xs text-red-600 hover:underline dark:text-red-400"
                        >
                          Batalkan
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
