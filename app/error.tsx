"use client";

import { useEffect } from "react";

import { APP_NAME } from "@/constants/app";

/**
 * Route-segment error boundary (PHASE 12). Wraps every page below the root
 * layout — an unhandled render/render-time error anywhere shows this
 * instead of crashing the whole app or leaking a raw stack trace. Never
 * displays `error.message` directly: Next.js already strips sensitive
 * detail from Server Component errors in production, but Client Component
 * errors still carry their original message — showing a fixed, generic
 * message here keeps that consistent regardless of where the error
 * originated (spec section 15 — don't leak internals).
 *
 * `console.error`, not `lib/logger.ts` (Pino, Node-only) — this file is a
 * Client Component ("use client"), so it also runs in the browser, where
 * Pino's Node built-ins (`fs`/`worker_threads`) don't exist.
 */
export default function ErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled render error", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-black">
      <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {APP_NAME}
      </p>
      <h1 className="mt-2 text-4xl font-semibold text-zinc-950 dark:text-zinc-50">
        Terjadi Kesalahan
      </h1>
      <p className="mt-4 max-w-md text-zinc-600 dark:text-zinc-400">
        Maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">Kode: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={() => retry()}
        className="mt-8 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        Coba Lagi
      </button>
    </div>
  );
}
