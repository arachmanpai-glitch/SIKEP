# SIKEP — Sistem Informasi Keuangan Pesantren

> Kelola Keuangan Lebih Mudah, Transparan, dan Terintegrasi.
> Sederhana untuk Bendahara. Transparan untuk Yayasan. Terkontrol untuk Pesantren.

SIKEP adalah aplikasi keuangan pesantren (bukan aplikasi sekolah pada
umumnya) untuk mengelola pemasukan, pengeluaran, tagihan santri,
pembayaran, anggaran, approval, dan pelaporan keuangan pesantren secara
terpusat dan auditable.

Status saat ini: **PHASE 1 — FOUNDATION**. Lihat [docs/decisions.md](docs/decisions.md)
untuk daftar keputusan phase dan [docs/architecture.md](docs/architecture.md)
untuk desain penuh.

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui ·
PostgreSQL · Prisma · Zod · Vitest · Pino.

## Menjalankan Secara Lokal

```bash
npm install
cp .env.example .env   # isi DATABASE_URL, dll.
npm run dev
```

Aplikasi berjalan di [http://localhost:3000](http://localhost:3000).

## Skrip

| Perintah              | Kegunaan                                    |
| --------------------- | ------------------------------------------- |
| `npm run dev`         | Jalankan dev server                         |
| `npm run build`       | Build production                            |
| `npm run start`       | Jalankan build production                   |
| `npm run lint`        | ESLint                                      |
| `npm run typecheck`   | Pengecekan tipe TypeScript (`tsc --noEmit`) |
| `npm run format`      | Format kode dengan Prettier                 |
| `npm run test`        | Jalankan seluruh unit test (Vitest)         |
| `npm run test:watch`  | Unit test mode watch                        |
| `npm run db:generate` | Generate Prisma Client                      |
| `npm run db:migrate`  | Jalankan migrasi Prisma (dev)               |
| `npm run db:studio`   | Buka Prisma Studio                          |

## Struktur Proyek

Lihat [docs/architecture.md](docs/architecture.md#struktur-proyek) untuk
penjelasan lengkap tiap folder dan alasannya.

## Dokumentasi

- [docs/architecture.md](docs/architecture.md) — arsitektur, layering, kontrak API, prinsip keuangan
- [docs/development.md](docs/development.md) — panduan setup & alur kerja pengembangan
- [docs/decisions.md](docs/decisions.md) — catatan keputusan teknis per phase
- [docs/step1/00-progress.md](docs/step1/00-progress.md) — checklist penerimaan PHASE 1
