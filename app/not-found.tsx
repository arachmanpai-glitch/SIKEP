import Link from "next/link";

import { APP_NAME } from "@/constants/app";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-black">
      <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {APP_NAME}
      </p>
      <h1 className="mt-2 text-4xl font-semibold text-zinc-950 dark:text-zinc-50">
        404 — Halaman Tidak Ditemukan
      </h1>
      <p className="mt-4 max-w-md text-zinc-600 dark:text-zinc-400">
        Halaman yang Anda cari tidak ada atau sudah dipindahkan.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}
