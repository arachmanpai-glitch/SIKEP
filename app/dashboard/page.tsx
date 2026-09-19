"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiGet } from "@/lib/client/api";
import { CURRENCY, LOCALE } from "@/constants/app";
import type { DashboardSummary } from "@/services/DashboardService";

const moneyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" });

const BILL_STATUS_COLORS = { unpaid: "#dc2626", partial: "#d97706", paid: "#16a34a" };

function Card({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold ${
          tone === "danger" ? "text-red-600 dark:text-red-400" : "text-zinc-950 dark:text-zinc-50"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setSummary(await apiGet<DashboardSummary>("/api/v1/dashboard/summary"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat dashboard.");
      }
    }
    void load();
  }, []);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <p className="text-sm text-zinc-500">Memuat...</p>
      </div>
    );
  }

  const billStatusData = [
    { name: "Belum Bayar", key: "unpaid", value: summary.billStatus.unpaid },
    { name: "Sebagian", key: "partial", value: summary.billStatus.partial },
    { name: "Lunas", key: "paid", value: summary.billStatus.paid },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Dashboard</h1>
        <Link href="/laporan" className="text-sm underline">
          Laporan
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Total Saldo Kas & Bank"
          value={moneyFormatter.format(Number(summary.totalBalance))}
        />
        <Card
          label="Pemasukan Bulan Ini"
          value={moneyFormatter.format(Number(summary.currentMonth.income))}
        />
        <Card
          label="Pengeluaran Bulan Ini"
          value={moneyFormatter.format(Number(summary.currentMonth.expense))}
        />
        <Card
          label="Net Bulan Ini"
          value={moneyFormatter.format(Number(summary.currentMonth.net))}
          tone={Number(summary.currentMonth.net) < 0 ? "danger" : undefined}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Approval Pending" value={String(summary.pendingApprovalCount)} />
        <Card label="Tagihan Belum Bayar" value={String(summary.billStatus.unpaid)} />
        <Card label="Tagihan Sebagian" value={String(summary.billStatus.partial)} />
        <Card
          label="Total Piutang Santri"
          value={moneyFormatter.format(Number(summary.billStatus.outstandingAmount))}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Pemasukan vs Pengeluaran (6 Bulan Terakhir)
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v: number) => String(v / 1000) + "k"} />
                <Tooltip formatter={(v) => moneyFormatter.format(Number(v))} />
                <Legend />
                <Bar dataKey="income" name="Pemasukan" fill="#16a34a" />
                <Bar dataKey="expense" name="Pengeluaran" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Status Tagihan Santri
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={billStatusData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {billStatusData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={BILL_STATUS_COLORS[entry.key as keyof typeof BILL_STATUS_COLORS]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Transaksi Terbaru</h2>
        {summary.recentTransactions.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Belum ada transaksi.</p>
        ) : (
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium text-zinc-500">Tanggal</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Jenis</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Kategori</th>
                <th className="py-2 pr-4 text-right font-medium text-zinc-500">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {summary.recentTransactions.map((t) => (
                <tr
                  key={`${t.kind}-${t.id}`}
                  className="border-b border-zinc-100 dark:border-zinc-900"
                >
                  <td className="py-2 pr-4">{dateFormatter.format(new Date(t.transactionDate))}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={
                        t.kind === "INCOME"
                          ? "text-green-700 dark:text-green-400"
                          : "text-red-700 dark:text-red-400"
                      }
                    >
                      {t.kind === "INCOME" ? "Pemasukan" : "Pengeluaran"}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{t.category}</td>
                  <td className="py-2 pr-4 text-right">
                    {moneyFormatter.format(Number(t.amount))}
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
