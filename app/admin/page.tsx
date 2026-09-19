import Link from "next/link";

import { masterDataUiConfig } from "@/lib/master-data/ui-config";
import { MASTER_DATA_ENTITIES } from "@/lib/master-data/entities";

const links = [
  { href: "/admin/santri", label: "Data Santri" },
  { href: "/admin/users", label: "User" },
  ...MASTER_DATA_ENTITIES.map((slug) => ({
    href: `/admin/master-data/${slug}`,
    label: masterDataUiConfig[slug].label,
  })),
];

export default function AdminHomePage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Master Data</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Dikelola oleh ADMIN (spec section 2). Pengaturan approval ada di{" "}
        <Link href="/admin/settings" className="underline">
          Pengaturan
        </Link>
        .
      </p>
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block rounded-md border border-zinc-200 px-4 py-3 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
