"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/LogoutButton";
import { apiGet, apiMutate } from "@/lib/client/api";
import { CURRENCY, LOCALE } from "@/constants/app";

const moneyFormatter = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });
const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "medium",
  timeStyle: "short",
});

interface OptionDto {
  id: string;
  name: string;
}

interface ExpenseDto {
  id: string;
  financialAccountId: string;
  categoryId: string;
  amount: string;
  transactionDate: string;
  description: string | null;
  status: string;
}

interface ApprovalRequestDto {
  id: string;
  expenseTransactionId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedById: string;
  decidedById: string | null;
  decidedAt: string | null;
  reason: string | null;
  thresholdAmountSnapshot: string | null;
  createdAt: string;
}

export default function PersetujuanPage() {
  const [requests, setRequests] = useState<ApprovalRequestDto[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDto[]>([]);
  const [accounts, setAccounts] = useState<OptionDto[]>([]);
  const [categories, setCategories] = useState<OptionDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function reload() {
    setIsLoading(true);
    try {
      const [requestList, expenseList, accountList, categoryList] = await Promise.all([
        apiGet<ApprovalRequestDto[]>("/api/v1/approval-requests"),
        apiGet<ExpenseDto[]>("/api/v1/expenses"),
        apiGet<OptionDto[]>("/api/v1/master-data/financial-accounts"),
        apiGet<OptionDto[]>("/api/v1/master-data/transaction-categories"),
      ]);
      setRequests(requestList);
      setExpenses(expenseList);
      setAccounts(accountList);
      setCategories(categoryList);
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

  function expenseOf(id: string): ExpenseDto | undefined {
    return expenses.find((e) => e.id === id);
  }
  function nameOf(list: OptionDto[], id: string | undefined): string {
    return list.find((o) => o.id === id)?.name ?? "(tidak dikenal)";
  }

  async function handleApprove(id: string) {
    setError(null);
    setSuccessMessage(null);
    setBusyId(id);
    try {
      await apiMutate(`/api/v1/approval-requests/${id}/approve`, "POST");
      setSuccessMessage("Pengeluaran disetujui dan telah diposting ke ledger.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyetujui.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) {
      setError("Alasan penolakan wajib diisi.");
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setBusyId(id);
    try {
      await apiMutate(`/api/v1/approval-requests/${id}/reject`, "POST", { reason: rejectReason });
      setSuccessMessage("Pengajuan ditolak.");
      setRejectingId(null);
      setRejectReason("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menolak.");
    } finally {
      setBusyId(null);
    }
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const decided = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Persetujuan Pengeluaran
        </h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="underline">
            Dashboard
          </Link>
          <LogoutButton />
        </div>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Pengajuan dari Bendahara yang di atas ambang batas atau kategori wajib approval (spec
        section 11). Anda tidak bisa memutuskan pengajuan yang Anda buat sendiri.
      </p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {successMessage && (
        <p className="mt-4 text-sm text-green-700 dark:text-green-400">{successMessage}</p>
      )}

      <div className="mt-6">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Menunggu Keputusan ({pending.length})
        </h2>
        {isLoading ? (
          <p className="mt-2 text-sm text-zinc-500">Memuat...</p>
        ) : pending.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Tidak ada pengajuan yang menunggu.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map((r) => {
              const expense = expenseOf(r.expenseTransactionId);
              return (
                <li
                  key={r.id}
                  className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {nameOf(categories, expense?.categoryId)} —{" "}
                        {moneyFormatter.format(Number(expense?.amount ?? 0))}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Akun: {nameOf(accounts, expense?.financialAccountId)} · Diajukan{" "}
                        {dateTimeFormatter.format(new Date(r.createdAt))}
                      </p>
                      {expense?.description && (
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {expense.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void handleApprove(r.id)}
                      className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-green-600"
                    >
                      Setujui
                    </button>
                    {rejectingId === r.id ? (
                      <>
                        <input
                          autoFocus
                          placeholder="Alasan penolakan..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="w-48 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void handleReject(r.id)}
                          className="text-sm text-red-600 hover:underline dark:text-red-400"
                        >
                          Konfirmasi Tolak
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(null);
                            setRejectReason("");
                          }}
                          className="text-sm text-zinc-500 hover:underline"
                        >
                          Batal
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRejectingId(r.id)}
                        className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400"
                      >
                        Tolak
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {decided.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Riwayat Keputusan
          </h2>
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium text-zinc-500">Kategori</th>
                <th className="py-2 pr-4 text-right font-medium text-zinc-500">Jumlah</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Status</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Alasan</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((r) => {
                const expense = expenseOf(r.expenseTransactionId);
                return (
                  <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-4">{nameOf(categories, expense?.categoryId)}</td>
                    <td className="py-2 pr-4 text-right">
                      {moneyFormatter.format(Number(expense?.amount ?? 0))}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          r.status === "APPROVED"
                            ? "text-green-700 dark:text-green-400"
                            : "text-red-700 dark:text-red-400"
                        }
                      >
                        {r.status === "APPROVED" ? "DISETUJUI" : "DITOLAK"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-zinc-500">{r.reason ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
