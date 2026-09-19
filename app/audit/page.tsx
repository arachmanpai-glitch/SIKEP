"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";

import { apiGet } from "@/lib/client/api";
import { LOCALE } from "@/constants/app";
import { AUDIT_ACTIONS } from "@/lib/validation/audit";

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "medium",
  timeStyle: "short",
});

interface AuditLogRow {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: unknown;
  newValues: unknown;
  createdAt: string;
}

interface AuditLogPageDto {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;

export default function AuditPage() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditLogPageDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (action) params.set("action", action);
      if (entityType) params.set("entityType", entityType);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      setData(await apiGet<AuditLogPageDto>(`/api/v1/audit-logs?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat audit log.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function applyFilters() {
    setPage(1);
    void load();
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Audit Log</h1>
        <Link href="/dashboard" className="text-sm underline">
          Dashboard
        </Link>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Catatan immutable setiap aksi kritikal (spec section 16) — hanya untuk Admin dan Yayasan.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="action" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Aksi
          </label>
          <select
            id="action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Semua Aksi</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="entityType"
            className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300"
          >
            Tipe Entitas
          </label>
          <input
            id="entityType"
            placeholder="ExpenseTransaction"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="from" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Dari Tanggal
          </label>
          <input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="to" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Sampai Tanggal
          </label>
          <input
            id="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          type="button"
          onClick={applyFilters}
          disabled={isLoading}
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
        >
          {isLoading ? "Memuat..." : "Terapkan Filter"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {data && (
        <>
          <table className="mt-6 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium text-zinc-500">Waktu</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Aksi</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Entitas</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">User</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-4">
                      {dateTimeFormatter.format(new Date(row.createdAt))}
                    </td>
                    <td className="py-2 pr-4">{row.action}</td>
                    <td className="py-2 pr-4">
                      {row.entityType}
                      {row.entityId ? ` (${row.entityId.slice(0, 8)}...)` : ""}
                    </td>
                    <td className="py-2 pr-4">
                      {row.userId ? `${row.userId.slice(0, 8)}...` : "-"}
                    </td>
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                        className="text-xs underline"
                      >
                        {expanded === row.id ? "Sembunyikan" : "Detail"}
                      </button>
                    </td>
                  </tr>
                  {expanded === row.id && (
                    <tr className="border-b border-zinc-100 dark:border-zinc-900">
                      <td colSpan={5} className="bg-zinc-50 py-2 pr-4 text-xs dark:bg-zinc-900">
                        <pre className="overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify({ old: row.oldValues, new: row.newValues }, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-zinc-500">
                    Tidak ada audit log yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-zinc-500">
              Halaman {data.page} dari {totalPages} ({data.total} total)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 disabled:opacity-50 dark:border-zinc-700"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 disabled:opacity-50 dark:border-zinc-700"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
