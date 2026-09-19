import Link from "next/link";

import { LogoutButton } from "@/components/LogoutButton";
import { APP_FULL_NAME, APP_NAME, APP_TAGLINE } from "@/constants/app";
import { getSession } from "@/lib/rbac";

export default async function Home() {
  const session = await getSession();

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-black">
      <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {APP_FULL_NAME}
      </p>
      <h1 className="mt-2 text-4xl font-semibold text-zinc-950 dark:text-zinc-50">{APP_NAME}</h1>
      <p className="mt-4 max-w-md text-zinc-600 dark:text-zinc-400">{APP_TAGLINE}</p>

      <div className="mt-8 flex flex-col items-center gap-3">
        {session ? (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Masuk sebagai{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{session.email}</span>{" "}
              ({session.roleCode})
            </p>
            <Link
              href="/dashboard"
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Dashboard
            </Link>
            <Link href="/laporan" className="text-sm underline">
              Laporan
            </Link>
            {session.roleCode === "BENDAHARA" && (
              <Link href="/rekonsiliasi" className="text-sm underline">
                Rekonsiliasi
              </Link>
            )}
            {(session.roleCode === "ADMIN" || session.roleCode === "YAYASAN") && (
              <Link href="/audit" className="text-sm underline">
                Audit Log
              </Link>
            )}
            {session.roleCode === "ADMIN" && (
              <Link href="/admin" className="text-sm underline">
                Master Data
              </Link>
            )}
            <LogoutButton />
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Masuk
          </Link>
        )}
      </div>

      <p className="mt-8 rounded-full border border-zinc-200 px-4 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        PHASE 12 — PRODUCTION
      </p>
    </div>
  );
}
