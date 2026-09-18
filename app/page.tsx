import { APP_FULL_NAME, APP_NAME, APP_TAGLINE } from "@/constants/app";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-black">
      <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {APP_FULL_NAME}
      </p>
      <h1 className="mt-2 text-4xl font-semibold text-zinc-950 dark:text-zinc-50">{APP_NAME}</h1>
      <p className="mt-4 max-w-md text-zinc-600 dark:text-zinc-400">{APP_TAGLINE}</p>
      <p className="mt-8 rounded-full border border-zinc-200 px-4 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        PHASE 1 — FOUNDATION
      </p>
    </div>
  );
}
