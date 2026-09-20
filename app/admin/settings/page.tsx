"use client";

import { type FormEvent, useEffect, useState } from "react";

import { LogoutButton } from "@/components/LogoutButton";
import { apiGet, apiMutate } from "@/lib/client/api";

interface ApprovalSettingsDto {
  id: string;
  expenseApprovalThreshold: string;
  allowNegativeBalance: boolean;
}

export default function ApprovalSettingsPage() {
  const [threshold, setThreshold] = useState("");
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    apiGet<ApprovalSettingsDto>("/api/v1/settings/approval")
      .then((data) => {
        setThreshold(data.expenseApprovalThreshold);
        setAllowNegativeBalance(data.allowNegativeBalance);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Gagal memuat pengaturan."),
      )
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      await apiMutate("/api/v1/settings/approval", "PATCH", {
        expenseApprovalThreshold: threshold,
        allowNegativeBalance,
      });
      setMessage("Pengaturan tersimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className="mx-auto max-w-lg px-6 py-10 text-sm text-zinc-500">Memuat...</p>;
  }

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Pengaturan Approval
        </h1>
        <LogoutButton />
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Threshold pengeluaran yang wajib melalui approval Yayasan (spec section 11).
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="threshold"
            className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300"
          >
            Threshold Approval Pengeluaran (Rp)
          </label>
          <input
            id="threshold"
            type="text"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="1000000.00"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="allowNegativeBalance"
            type="checkbox"
            checked={allowNegativeBalance}
            onChange={(e) => setAllowNegativeBalance(e.target.checked)}
          />
          <label
            htmlFor="allowNegativeBalance"
            className="text-sm text-zinc-700 dark:text-zinc-300"
          >
            Izinkan saldo akun menjadi negatif
          </label>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
        >
          {isSubmitting ? "Menyimpan..." : "Simpan"}
        </button>
      </form>
    </div>
  );
}
