"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { LogoutButton } from "@/components/LogoutButton";
import { apiGet, apiMutate } from "@/lib/client/api";
import { CURRENCY, LOCALE } from "@/constants/app";
import type {
  CloseFinancialPeriodResult,
  ReconciliationRow,
} from "@/services/FinancialPeriodService";

const moneyFormatter = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });
const dateFormatter = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" });

interface PeriodDto {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "CLOSED";
  closedAt: string | null;
}

interface AccountDto {
  id: string;
  name: string;
  type: string;
}

const emptyPeriodForm = { name: "", startDate: "", endDate: "" };

function CreatePeriodForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState(emptyPeriodForm);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiMutate("/api/v1/financial-periods", "POST", form);
      setForm(emptyPeriodForm);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat periode.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 grid grid-cols-1 gap-4 rounded-md border border-zinc-200 p-4 sm:grid-cols-3 dark:border-zinc-800"
    >
      <div>
        <label htmlFor="name" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
          Nama Periode *
        </label>
        <input
          id="name"
          required
          placeholder="Januari 2026"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label htmlFor="startDate" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
          Tanggal Mulai *
        </label>
        <input
          id="startDate"
          type="date"
          required
          value={form.startDate}
          onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label htmlFor="endDate" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
          Tanggal Selesai *
        </label>
        <input
          id="endDate"
          type="date"
          required
          value={form.endDate}
          onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 sm:col-span-3 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
        >
          {isSubmitting ? "Menyimpan..." : "Buat Periode"}
        </button>
      </div>
    </form>
  );
}

function ClosePeriodForm({
  period,
  accounts,
  onClosed,
}: {
  period: PeriodDto;
  accounts: AccountDto[];
  onClosed: () => void;
}) {
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReconciliationRow[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const balances = accounts.map((a) => ({
        financialAccountId: a.id,
        actualBalance: actuals[a.id] || "0",
      }));
      const response = await apiMutate<CloseFinancialPeriodResult>(
        `/api/v1/financial-periods/${period.id}/close`,
        "POST",
        { balances },
      );
      setResult(response.reconciliation);
      onClosed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menutup periode.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="mt-3 rounded-md border border-green-300 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950">
        <p className="font-medium text-green-800 dark:text-green-300">
          Periode &quot;{period.name}&quot; berhasil ditutup.
        </p>
        <table className="mt-2 w-full text-xs">
          <tbody>
            {result.map((row) => (
              <tr key={row.financialAccountId}>
                <td className="pr-3">{row.financialAccountName}</td>
                <td className="pr-3 text-right">
                  Sistem: {moneyFormatter.format(Number(row.systemBalance))}
                </td>
                <td className="pr-3 text-right">
                  Aktual: {moneyFormatter.format(Number(row.actualBalance))}
                </td>
                <td
                  className={`text-right ${Number(row.difference) !== 0 ? "font-semibold text-amber-700 dark:text-amber-400" : ""}`}
                >
                  Selisih: {moneyFormatter.format(Number(row.difference))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
    >
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Tutup periode &quot;{period.name}&quot; — isi saldo aktual (hasil hitung kas/cek rekening
        koran) per akun:
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {accounts.map((account) => (
          <div key={account.id}>
            <label
              htmlFor={`actual-${account.id}`}
              className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400"
            >
              {account.name} ({account.type})
            </label>
            <input
              id={`actual-${account.id}`}
              type="text"
              placeholder="0.00"
              value={actuals[account.id] ?? ""}
              onChange={(e) => setActuals((a) => ({ ...a, [account.id]: e.target.value }))}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting || accounts.length === 0}
        className="mt-3 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
      >
        {isSubmitting ? "Menutup..." : "Tutup Periode"}
      </button>
    </form>
  );
}

export default function RekonsiliasiPage() {
  const [periods, setPeriods] = useState<PeriodDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [closingPeriodId, setClosingPeriodId] = useState<string | null>(null);

  async function reload() {
    setIsLoading(true);
    try {
      const [periodList, accountList] = await Promise.all([
        apiGet<PeriodDto[]>("/api/v1/financial-periods"),
        apiGet<AccountDto[]>("/api/v1/master-data/financial-accounts"),
      ]);
      setPeriods(periodList);
      setAccounts(accountList);
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

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Rekonsiliasi & Periode Keuangan
        </h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="underline">
            Dashboard
          </Link>
          <LogoutButton />
        </div>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Menutup periode mengunci semua tanggal di dalamnya — pemasukan/pengeluaran baru dengan
        tanggal transaksi di periode yang sudah ditutup akan ditolak.
      </p>

      <CreatePeriodForm onCreated={reload} />

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-8">
        {isLoading ? (
          <p className="text-sm text-zinc-500">Memuat...</p>
        ) : periods.length === 0 ? (
          <p className="text-sm text-zinc-500">Belum ada periode keuangan.</p>
        ) : (
          <ul className="space-y-3">
            {periods.map((period) => (
              <li
                key={period.id}
                className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{period.name}</p>
                    <p className="text-xs text-zinc-500">
                      {dateFormatter.format(new Date(period.startDate))} —{" "}
                      {dateFormatter.format(new Date(period.endDate))}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      period.status === "OPEN"
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {period.status === "OPEN" ? "Terbuka" : "Ditutup"}
                  </span>
                </div>
                {period.status === "OPEN" && closingPeriodId !== period.id && (
                  <button
                    type="button"
                    onClick={() => setClosingPeriodId(period.id)}
                    className="mt-2 text-sm underline"
                  >
                    Tutup periode ini
                  </button>
                )}
                {period.status === "OPEN" && closingPeriodId === period.id && (
                  <ClosePeriodForm period={period} accounts={accounts} onClosed={reload} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
