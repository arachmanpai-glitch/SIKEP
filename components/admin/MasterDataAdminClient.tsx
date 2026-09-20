"use client";

import { type FormEvent, useEffect, useState } from "react";

import { LogoutButton } from "@/components/LogoutButton";
import { apiGet, apiMutate } from "@/lib/client/api";
import type { MasterDataEntitySlug } from "@/lib/master-data/entities";
import { masterDataUiConfig } from "@/lib/master-data/ui-config";

type Record_ = { id: string; isActive?: boolean } & Record<string, unknown>;

function emptyFormState(entity: MasterDataEntitySlug): Record<string, string | boolean> {
  const state: Record<string, string | boolean> = {};
  for (const field of masterDataUiConfig[entity].fields) {
    state[field.name] = field.type === "boolean" ? true : "";
  }
  return state;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (value instanceof Date) return value.toLocaleDateString("id-ID");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleDateString("id-ID");
  }
  return String(value);
}

export function MasterDataAdminClient({ entity }: { entity: MasterDataEntitySlug }) {
  const config = masterDataUiConfig[entity];
  const [records, setRecords] = useState<Record_[]>([]);
  const [formState, setFormState] = useState(() => emptyFormState(entity));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function reload() {
    setIsLoading(true);
    try {
      const data = await apiGet<Record_[]>(`/api/v1/master-data/${entity}`);
      setRecords(data);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiMutate(`/api/v1/master-data/${entity}`, "POST", formState);
      setFormState(emptyFormState(entity));
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
      await apiMutate(`/api/v1/master-data/${entity}/${id}`, "DELETE");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menonaktifkan.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{config.label}</h1>
        <LogoutButton />
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <form
        onSubmit={handleCreate}
        className="mt-6 grid grid-cols-1 gap-4 rounded-md border border-zinc-200 p-4 sm:grid-cols-2 dark:border-zinc-800"
      >
        {config.fields.map((field) => (
          <div
            key={field.name}
            className={field.type === "boolean" ? "flex items-center gap-2" : ""}
          >
            {field.type === "boolean" ? (
              <>
                <input
                  id={field.name}
                  type="checkbox"
                  checked={Boolean(formState[field.name])}
                  onChange={(e) => setFormState((s) => ({ ...s, [field.name]: e.target.checked }))}
                />
                <label htmlFor={field.name} className="text-sm text-zinc-700 dark:text-zinc-300">
                  {field.label}
                </label>
              </>
            ) : (
              <>
                <label
                  htmlFor={field.name}
                  className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300"
                >
                  {field.label}
                  {field.required ? " *" : ""}
                </label>
                {field.type === "select" ? (
                  <select
                    id={field.name}
                    required={field.required}
                    value={String(formState[field.name] ?? "")}
                    onChange={(e) => setFormState((s) => ({ ...s, [field.name]: e.target.value }))}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="" disabled>
                      Pilih...
                    </option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={field.name}
                    type={field.type === "date" ? "date" : "text"}
                    required={field.required}
                    value={String(formState[field.name] ?? "")}
                    onChange={(e) => setFormState((s) => ({ ...s, [field.name]: e.target.value }))}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                )}
                {field.help && <p className="mt-1 text-xs text-zinc-500">{field.help}</p>}
              </>
            )}
          </div>
        ))}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
          >
            {isSubmitting ? "Menyimpan..." : `Tambah ${config.label}`}
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
                {config.fields.map((field) => (
                  <th key={field.name} className="py-2 pr-4 font-medium text-zinc-500">
                    {field.label}
                  </th>
                ))}
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  {config.fields.map((field) => (
                    <td key={field.name} className="py-2 pr-4">
                      {formatCell(record[field.name])}
                    </td>
                  ))}
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleDeactivate(record.id)}
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
