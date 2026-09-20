"use client";

import Link from "next/link";
import { Fragment, type FormEvent, useEffect, useState } from "react";

import { AttachmentPanel } from "@/components/attachments/AttachmentPanel";
import { apiGet, apiMutate } from "@/lib/client/api";
import { CURRENCY, LOCALE } from "@/constants/app";

const moneyFormatter = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });
const dateFormatter = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" });

interface OptionDto {
  id: string;
  name: string;
  type?: string;
  requiresApproval?: boolean;
  isActive?: boolean;
}

interface ExpenseDto {
  id: string;
  financialAccountId: string;
  categoryId: string;
  amount: string;
  transactionDate: string;
  description: string | null;
  status: "POSTED" | "PENDING_APPROVAL" | "REJECTED" | "VOIDED";
  voidReason: string | null;
}

const STATUS_LABEL: Record<ExpenseDto["status"], string> = {
  POSTED: "POSTED",
  PENDING_APPROVAL: "MENUNGGU APPROVAL",
  REJECTED: "DITOLAK",
  VOIDED: "DIBATALKAN",
};

const emptyForm = {
  financialAccountId: "",
  categoryId: "",
  amount: "",
  transactionDate: new Date().toISOString().slice(0, 10),
  description: "",
};

export default function PengeluaranPage() {
  const [accounts, setAccounts] = useState<OptionDto[]>([]);
  const [categories, setCategories] = useState<OptionDto[]>([]);
  const [records, setRecords] = useState<ExpenseDto[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function reload() {
    setIsLoading(true);
    try {
      const [accountList, categoryList, expenseList] = await Promise.all([
        apiGet<OptionDto[]>("/api/v1/master-data/financial-accounts"),
        apiGet<OptionDto[]>("/api/v1/master-data/transaction-categories"),
        apiGet<ExpenseDto[]>("/api/v1/expenses"),
      ]);
      setAccounts(accountList.filter((a) => a.isActive !== false));
      setCategories(categoryList.filter((c) => c.type === "EXPENSE" && c.isActive !== false));
      setRecords(expenseList);
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
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const result = await apiMutate<ExpenseDto>("/api/v1/expenses", "POST", {
        financialAccountId: form.financialAccountId,
        categoryId: form.categoryId,
        amount: form.amount,
        transactionDate: form.transactionDate,
        description: form.description || undefined,
      });
      setSuccessMessage(
        result.status === "PENDING_APPROVAL"
          ? "Pengeluaran diajukan — menunggu approval Yayasan (di atas ambang batas atau kategori wajib approval)."
          : "Pengeluaran berhasil dicatat dan langsung diposting.",
      );
      setForm((f) => ({ ...emptyForm, transactionDate: f.transactionDate }));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencatat pengeluaran.");
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
      await apiMutate(`/api/v1/expenses/${id}/void`, "POST", { reason: voidReason });
      setVoidingId(null);
      setVoidReason("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membatalkan pengeluaran.");
    }
  }

  function nameOf(list: OptionDto[], id: string): string {
    return list.find((o) => o.id === id)?.name ?? "(tidak dikenal)";
  }

  function statusClassName(status: ExpenseDto["status"]): string {
    switch (status) {
      case "POSTED":
        return "text-green-700 dark:text-green-400";
      case "PENDING_APPROVAL":
        return "text-amber-700 dark:text-amber-400";
      case "REJECTED":
        return "text-red-700 dark:text-red-400";
      default:
        return "text-zinc-500 line-through";
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Catat Pengeluaran
        </h1>
        <Link href="/dashboard" className="text-sm underline">
          Dashboard
        </Link>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Pengeluaran di atas ambang batas (atau kategori yang wajib approval) akan menunggu
        persetujuan Yayasan sebelum diposting ke ledger (spec section 11).
      </p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {successMessage && (
        <p className="mt-4 text-sm text-green-700 dark:text-green-400">{successMessage}</p>
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
                {c.requiresApproval ? " (wajib approval)" : ""}
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
        <div className="sm:col-span-2">
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
            {isSubmitting ? "Menyimpan..." : "Catat Pengeluaran"}
          </button>
        </div>
      </form>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Riwayat Pengeluaran
        </h2>
        {isLoading ? (
          <p className="mt-2 text-sm text-zinc-500">Memuat...</p>
        ) : records.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Belum ada pengeluaran tercatat.</p>
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
                <Fragment key={r.id}>
                  <tr className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-4">
                      {dateFormatter.format(new Date(r.transactionDate))}
                    </td>
                    <td className="py-2 pr-4">{nameOf(accounts, r.financialAccountId)}</td>
                    <td className="py-2 pr-4">{nameOf(categories, r.categoryId)}</td>
                    <td className="py-2 pr-4 text-right">
                      {moneyFormatter.format(Number(r.amount))}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={statusClassName(r.status)}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                          className="text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                        >
                          Lampiran
                        </button>
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
                      </div>
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr className="border-b border-zinc-100 dark:border-zinc-900">
                      <td colSpan={6} className="bg-zinc-50 py-2 pr-4 dark:bg-zinc-950">
                        <AttachmentPanel entityType="EXPENSE_TRANSACTION" entityId={r.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
