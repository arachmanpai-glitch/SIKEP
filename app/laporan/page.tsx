"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiGet } from "@/lib/client/api";
import { CURRENCY, LOCALE } from "@/constants/app";
import type { BillingReport, FinancialReport } from "@/services/ReportService";

const moneyFormatter = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(): string {
  const now = new Date();
  return toIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
}

interface OptionDto {
  id: string;
  name: string;
}

const BILL_STATUS_OPTIONS = ["", "UNPAID", "PARTIAL", "PAID", "VOIDED"] as const;
const BILL_STATUS_LABELS: Record<string, string> = {
  "": "Semua Status",
  UNPAID: "Belum Bayar",
  PARTIAL: "Sebagian",
  PAID: "Lunas",
  VOIDED: "Dibatalkan",
};

function FinancialReportSection() {
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(toIsoDate(new Date()));
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      setReport(await apiGet<FinancialReport>(`/api/v1/reports/financial?from=${from}&to=${to}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat laporan.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportUrl(format: "pdf" | "xlsx") {
    return `/api/v1/reports/financial/export?from=${from}&to=${to}&format=${format}`;
  }

  return (
    <section className="mt-8 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Laporan Keuangan</h2>

      <div className="mt-4 flex flex-wrap items-end gap-3">
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
          onClick={() => void load()}
          disabled={isLoading}
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
        >
          {isLoading ? "Memuat..." : "Tampilkan"}
        </button>
        <a
          href={exportUrl("pdf")}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Export PDF
        </a>
        <a
          href={exportUrl("xlsx")}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Export XLSX
        </a>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {report && (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Pemasukan</h3>
            <table className="mt-2 w-full border-collapse text-sm">
              <tbody>
                {report.income.map((row) => (
                  <tr
                    key={row.categoryId}
                    className="border-b border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="py-1 pr-4">{row.categoryName}</td>
                    <td className="py-1 text-right">{moneyFormatter.format(Number(row.total))}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="py-1 pr-4">Total</td>
                  <td className="py-1 text-right">
                    {moneyFormatter.format(Number(report.totalIncome))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Pengeluaran</h3>
            <table className="mt-2 w-full border-collapse text-sm">
              <tbody>
                {report.expense.map((row) => (
                  <tr
                    key={row.categoryId}
                    className="border-b border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="py-1 pr-4">{row.categoryName}</td>
                    <td className="py-1 text-right">{moneyFormatter.format(Number(row.total))}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="py-1 pr-4">Total</td>
                  <td className="py-1 text-right">
                    {moneyFormatter.format(Number(report.totalExpense))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm font-semibold text-zinc-950 sm:col-span-2 dark:text-zinc-50">
            Net: {moneyFormatter.format(Number(report.net))}
          </p>
        </div>
      )}
    </section>
  );
}

function BillingReportSection() {
  const [academicYears, setAcademicYears] = useState<OptionDto[]>([]);
  const [classes, setClasses] = useState<OptionDto[]>([]);
  const [academicYearId, setAcademicYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const [report, setReport] = useState<BillingReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [years, classList] = await Promise.all([
          apiGet<OptionDto[]>("/api/v1/master-data/academic-years"),
          apiGet<OptionDto[]>("/api/v1/master-data/classes"),
        ]);
        setAcademicYears(years);
        setClasses(classList);
      } catch {
        // Filters are optional — a failure here shouldn't block the report itself.
      }
    }
    void loadOptions();
  }, []);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (academicYearId) params.set("academicYearId", academicYearId);
      if (classId) params.set("classId", classId);
      if (status) params.set("status", status);
      setReport(await apiGet<BillingReport>(`/api/v1/reports/billing?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat laporan.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportUrl(format: "pdf" | "xlsx") {
    const params = new URLSearchParams();
    if (academicYearId) params.set("academicYearId", academicYearId);
    if (classId) params.set("classId", classId);
    if (status) params.set("status", status);
    params.set("format", format);
    return `/api/v1/reports/billing/export?${params.toString()}`;
  }

  return (
    <section className="mt-8 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        Laporan Tagihan Santri
      </h2>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="ay" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Tahun Ajaran
          </label>
          <select
            id="ay"
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Semua Tahun Ajaran</option>
            {academicYears.map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="class" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Kelas
          </label>
          <select
            id="class"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Semua Kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {BILL_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {BILL_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={isLoading}
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
        >
          {isLoading ? "Memuat..." : "Tampilkan"}
        </button>
        <a
          href={exportUrl("pdf")}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Export PDF
        </a>
        <a
          href={exportUrl("xlsx")}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Export XLSX
        </a>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {report && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium text-zinc-500">Santri</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Kelas</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Jenis Tagihan</th>
                <th className="py-2 pr-4 text-right font-medium text-zinc-500">Jumlah</th>
                <th className="py-2 pr-4 text-right font-medium text-zinc-500">Dibayar</th>
                <th className="py-2 pr-4 text-right font-medium text-zinc-500">Sisa</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.billId} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4">{row.santriName}</td>
                  <td className="py-2 pr-4">{row.className ?? "-"}</td>
                  <td className="py-2 pr-4">{row.billType}</td>
                  <td className="py-2 pr-4 text-right">
                    {moneyFormatter.format(Number(row.amount))}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {moneyFormatter.format(Number(row.amountPaid))}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {moneyFormatter.format(Number(row.remaining))}
                  </td>
                  <td className="py-2 pr-4">{BILL_STATUS_LABELS[row.status] ?? row.status}</td>
                </tr>
              ))}
              {report.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-zinc-500">
                    Tidak ada tagihan yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function LaporanPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Laporan</h1>
        <Link href="/dashboard" className="text-sm underline">
          Dashboard
        </Link>
      </div>
      <FinancialReportSection />
      <BillingReportSection />
    </div>
  );
}
