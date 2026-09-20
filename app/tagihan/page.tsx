"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { LogoutButton } from "@/components/LogoutButton";
import { apiGet, apiMutate } from "@/lib/client/api";
import { CURRENCY, LOCALE } from "@/constants/app";

const moneyFormatter = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });
const dateFormatter = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" });

interface OptionDto {
  id: string;
  name: string;
}

interface SantriDto {
  id: string;
  nis: string;
  fullName: string;
  classId: string | null;
  status: string;
}

interface BillDto {
  id: string;
  santriId: string;
  billTypeId: string;
  academicYearId: string;
  amount: string;
  amountPaid: string;
  status: "UNPAID" | "PARTIAL" | "PAID" | "VOIDED";
  dueDate: string | null;
  description: string | null;
}

const STATUS_LABEL: Record<BillDto["status"], string> = {
  UNPAID: "Belum Bayar",
  PARTIAL: "Sebagian",
  PAID: "Lunas",
  VOIDED: "Dibatalkan",
};

const STATUS_CLASS: Record<BillDto["status"], string> = {
  UNPAID: "text-red-700 dark:text-red-400",
  PARTIAL: "text-amber-700 dark:text-amber-400",
  PAID: "text-green-700 dark:text-green-400",
  VOIDED: "text-zinc-500 line-through",
};

export default function TagihanPage() {
  const [santriList, setSantriList] = useState<SantriDto[]>([]);
  const [classes, setClasses] = useState<OptionDto[]>([]);
  const [academicYears, setAcademicYears] = useState<OptionDto[]>([]);
  const [billTypes, setBillTypes] = useState<OptionDto[]>([]);
  const [bills, setBills] = useState<BillDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [mode, setMode] = useState<"individual" | "bulk">("individual");
  const [santriId, setSantriId] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [selectedSantriIds, setSelectedSantriIds] = useState<string[]>([]);
  const [billTypeId, setBillTypeId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");

  async function reload() {
    setIsLoading(true);
    try {
      const [santriRes, classList, yearList, billTypeList, billList] = await Promise.all([
        apiGet<SantriDto[]>("/api/v1/santri"),
        apiGet<OptionDto[]>("/api/v1/master-data/classes"),
        apiGet<OptionDto[]>("/api/v1/master-data/academic-years"),
        apiGet<OptionDto[]>("/api/v1/master-data/bill-types"),
        apiGet<BillDto[]>("/api/v1/santri-bills"),
      ]);
      setSantriList(santriRes.filter((s) => s.status === "ACTIVE"));
      setClasses(classList);
      setAcademicYears(yearList);
      setBillTypes(billTypeList);
      setBills(billList);
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

  const visibleSantri = useMemo(
    () => (classFilter ? santriList.filter((s) => s.classId === classFilter) : santriList),
    [santriList, classFilter],
  );

  function nameOf(list: OptionDto[], id: string): string {
    return list.find((o) => o.id === id)?.name ?? "(tidak dikenal)";
  }
  function santriNameOf(id: string): string {
    const s = santriList.find((x) => x.id === id);
    return s ? `${s.fullName} (${s.nis})` : "(tidak dikenal)";
  }

  function toggleSantri(id: string) {
    setSelectedSantriIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      if (mode === "individual") {
        await apiMutate("/api/v1/santri-bills", "POST", {
          santriId,
          billTypeId,
          academicYearId,
          amount,
          dueDate: dueDate || undefined,
          description: description || undefined,
        });
        setSuccessMessage("Tagihan berhasil dibuat.");
      } else {
        if (selectedSantriIds.length === 0) {
          throw new Error("Pilih minimal 1 santri untuk tagihan massal.");
        }
        await apiMutate("/api/v1/santri-bills/bulk", "POST", {
          santriIds: selectedSantriIds,
          billTypeId,
          academicYearId,
          amount,
          dueDate: dueDate || undefined,
          description: description || undefined,
        });
        setSuccessMessage(`Tagihan berhasil dibuat untuk ${selectedSantriIds.length} santri.`);
        setSelectedSantriIds([]);
      }
      setAmount("");
      setDescription("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat tagihan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Tagihan Santri</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/pembayaran" className="underline">
            Pembayaran
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

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("individual")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            mode === "individual"
              ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
              : "border border-zinc-300 dark:border-zinc-700"
          }`}
        >
          Tagihan Individual
        </button>
        <button
          type="button"
          onClick={() => setMode("bulk")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            mode === "bulk"
              ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
              : "border border-zinc-300 dark:border-zinc-700"
          }`}
        >
          Tagihan Massal
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-4 grid grid-cols-1 gap-4 rounded-md border border-zinc-200 p-4 sm:grid-cols-2 dark:border-zinc-800"
      >
        {mode === "individual" ? (
          <div className="sm:col-span-2">
            <label htmlFor="santri" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
              Santri *
            </label>
            <select
              id="santri"
              required
              value={santriId}
              onChange={(e) => setSantriId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Pilih santri...</option>
              {santriList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.nis})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
                Santri * ({selectedSantriIds.length} dipilih)
              </label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Semua Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-300 p-2 dark:border-zinc-700">
              {visibleSantri.map((s) => (
                <label key={s.id} className="flex items-center gap-2 py-0.5 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedSantriIds.includes(s.id)}
                    onChange={() => toggleSantri(s.id)}
                  />
                  {s.fullName} ({s.nis}) — {nameOf(classes, s.classId ?? "")}
                </label>
              ))}
              {visibleSantri.length === 0 && (
                <p className="text-xs text-zinc-500">Tidak ada santri.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedSantriIds(visibleSantri.map((s) => s.id))}
              className="mt-1 text-xs underline"
            >
              Pilih semua yang tampil
            </button>
          </div>
        )}

        <div>
          <label htmlFor="billType" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Jenis Tagihan *
          </label>
          <select
            id="billType"
            required
            value={billTypeId}
            onChange={(e) => setBillTypeId(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Pilih jenis tagihan...</option>
            {billTypes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="academicYear"
            className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300"
          >
            Tahun Ajaran *
          </label>
          <select
            id="academicYear"
            required
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Pilih tahun ajaran...</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
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
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="dueDate" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Jatuh Tempo
          </label>
          <input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
          >
            {isSubmitting ? "Menyimpan..." : "Buat Tagihan"}
          </button>
        </div>
      </form>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Daftar Tagihan</h2>
        {isLoading ? (
          <p className="mt-2 text-sm text-zinc-500">Memuat...</p>
        ) : bills.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Belum ada tagihan.</p>
        ) : (
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium text-zinc-500">Santri</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Jenis</th>
                <th className="py-2 pr-4 text-right font-medium text-zinc-500">Jumlah</th>
                <th className="py-2 pr-4 text-right font-medium text-zinc-500">Dibayar</th>
                <th className="py-2 pr-4 text-right font-medium text-zinc-500">Sisa</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Jatuh Tempo</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4">{santriNameOf(b.santriId)}</td>
                  <td className="py-2 pr-4">{nameOf(billTypes, b.billTypeId)}</td>
                  <td className="py-2 pr-4 text-right">
                    {moneyFormatter.format(Number(b.amount))}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {moneyFormatter.format(Number(b.amountPaid))}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {moneyFormatter.format(Number(b.amount) - Number(b.amountPaid))}
                  </td>
                  <td className="py-2 pr-4">
                    {b.dueDate ? dateFormatter.format(new Date(b.dueDate)) : "-"}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={STATUS_CLASS[b.status]}>{STATUS_LABEL[b.status]}</span>
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
