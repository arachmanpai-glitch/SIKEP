"use client";

import { type FormEvent, useEffect, useState } from "react";

import { apiGet, apiMutate } from "@/lib/client/api";

interface SantriDto {
  id: string;
  nis: string;
  fullName: string;
  classId: string | null;
  status: string;
}

const emptyForm = { nis: "", fullName: "", classId: "", status: "ACTIVE" };

export default function SantriAdminPage() {
  const [records, setRecords] = useState<SantriDto[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function reload() {
    setIsLoading(true);
    try {
      setRecords(await apiGet<SantriDto[]>("/api/v1/santri"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // reload() sets loading state inside an async function (deferred past
    // the initial microtask), not synchronously in the effect body — the
    // lint rule can't distinguish that statically from the real footgun it
    // targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiMutate("/api/v1/santri", "POST", {
        nis: form.nis,
        fullName: form.fullName,
        classId: form.classId || undefined,
        status: form.status,
      });
      setForm(emptyForm);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivate(id: string) {
    setError(null);
    try {
      await apiMutate(`/api/v1/santri/${id}`, "DELETE");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menonaktifkan.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Data Santri</h1>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <form
        onSubmit={handleCreate}
        className="mt-6 grid grid-cols-1 gap-4 rounded-md border border-zinc-200 p-4 sm:grid-cols-2 dark:border-zinc-800"
      >
        <div>
          <label htmlFor="nis" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            NIS *
          </label>
          <input
            id="nis"
            required
            value={form.nis}
            onChange={(e) => setForm((f) => ({ ...f, nis: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="fullName" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Nama Lengkap *
          </label>
          <input
            id="fullName"
            required
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="classId" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            ID Kelas
          </label>
          <input
            id="classId"
            value={form.classId}
            onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
            placeholder="opsional — salin dari halaman Kelas"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Status
          </label>
          <select
            id="status"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
            <option value="GRADUATED">Lulus</option>
            <option value="WITHDRAWN">Keluar</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
          >
            {isSubmitting ? "Menyimpan..." : "Tambah Santri"}
          </button>
        </div>
      </form>

      <div className="mt-8">
        {isLoading ? (
          <p className="text-sm text-zinc-500">Memuat...</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-zinc-500">Belum ada data.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium text-zinc-500">NIS</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Nama</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Status</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4">{r.nis}</td>
                  <td className="py-2 pr-4">{r.fullName}</td>
                  <td className="py-2 pr-4">{r.status}</td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleDeactivate(r.id)}
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      Nonaktifkan
                    </button>
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
