"use client";

import { type FormEvent, useEffect, useState } from "react";

import { apiGet, apiMutate } from "@/lib/client/api";
import { ROLE_CODES } from "@/constants/roles";

interface UserDto {
  id: string;
  fullName: string;
  email: string;
  roleCode: string;
  isActive: boolean;
}

const emptyForm = { fullName: "", email: "", password: "", roleCode: "BENDAHARA" };

export default function UsersAdminPage() {
  const [records, setRecords] = useState<UserDto[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function reload() {
    setIsLoading(true);
    try {
      setRecords(await apiGet<UserDto[]>("/api/v1/users"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // See app/admin/santri/page.tsx for why this disable is safe here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiMutate("/api/v1/users", "POST", form);
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
      await apiMutate(`/api/v1/users/${id}`, "DELETE");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menonaktifkan.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">User</h1>

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
          <label htmlFor="email" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Email *
          </label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Password Awal *
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="roleCode" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Role
          </label>
          <select
            id="roleCode"
            value={form.roleCode}
            onChange={(e) => setForm((f) => ({ ...f, roleCode: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {ROLE_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
          >
            {isSubmitting ? "Menyimpan..." : "Tambah User"}
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
                <th className="py-2 pr-4 font-medium text-zinc-500">Nama</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Email</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Role</th>
                <th className="py-2 pr-4 font-medium text-zinc-500">Aktif</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {records.map((u) => (
                <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4">{u.fullName}</td>
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4">{u.roleCode}</td>
                  <td className="py-2 pr-4">{u.isActive ? "Ya" : "Tidak"}</td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleDeactivate(u.id)}
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
