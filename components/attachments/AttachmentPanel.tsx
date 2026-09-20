"use client";

import { type ChangeEvent, useEffect, useState } from "react";

import { apiGet, apiUpload } from "@/lib/client/api";
import type { AttachableEntityType } from "@/lib/validation/attachment";

interface AttachmentDto {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
}

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(0)} KB`;
}

/**
 * "Bukti Transaksi" panel (docs/decisions.md D75) — lists + uploads
 * evidence attached to one income/expense/santri-payment transaction.
 * Upload always POSTs; the server (not this component) enforces the
 * BENDAHARA-only rule, same as every other mutating form in this app.
 */
export function AttachmentPanel({
  entityType,
  entityId,
}: {
  entityType: AttachableEntityType;
  entityId: string;
}) {
  const [attachments, setAttachments] = useState<AttachmentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setIsLoading(true);
    try {
      const list = await apiGet<AttachmentDto[]>(
        `/api/v1/attachments?entityType=${entityType}&entityId=${entityId}`,
      );
      setAttachments(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat lampiran.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);
      formData.append("file", file);
      await apiUpload("/api/v1/attachments", formData);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah lampiran.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload(attachmentId: string) {
    setError(null);
    try {
      const { url } = await apiGet<{ url: string }>(
        `/api/v1/attachments/${attachmentId}/download-url`,
      );
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat tautan unduhan.");
    }
  }

  return (
    <div className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">Bukti Transaksi</span>
        <label className="cursor-pointer text-zinc-600 underline dark:text-zinc-400">
          {isUploading ? "Mengunggah..." : "+ Unggah"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => void handleUpload(e)}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="mt-2 text-zinc-500">Memuat...</p>
      ) : attachments.length === 0 ? (
        <p className="mt-2 text-zinc-500">Belum ada lampiran.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void handleDownload(a.id)}
                className="truncate text-left text-zinc-700 underline dark:text-zinc-300"
                title={a.fileName}
              >
                {a.fileName}
              </button>
              <span className="shrink-0 text-zinc-400">{formatSize(a.fileSizeBytes)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
