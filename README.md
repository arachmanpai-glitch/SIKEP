# SIKEP — Sistem Informasi Keuangan Pesantren

> Kelola Keuangan Lebih Mudah, Transparan, dan Terintegrasi.
> Sederhana untuk Bendahara. Transparan untuk Yayasan. Terkontrol untuk Pesantren.

SIKEP adalah aplikasi keuangan pesantren (bukan aplikasi sekolah pada
umumnya) untuk mengelola pemasukan, pengeluaran, tagihan santri,
pembayaran, anggaran, approval, dan pelaporan keuangan pesantren secara
terpusat dan auditable.

Status saat ini: **PHASE 12 — PRODUCTION** (phase terakhir dari 12 phase
resmi). Lihat [docs/decisions.md](docs/decisions.md)
untuk daftar keputusan phase dan [docs/architecture.md](docs/architecture.md)
untuk desain penuh.

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui ·
PostgreSQL · Prisma · Zod · Vitest · Pino · Recharts · pdfkit · exceljs.

## Menjalankan Secara Lokal

```bash
npm install
cp .env.example .env   # isi DATABASE_URL dan AUTH_SECRET (wajib, min. 32 karakter)
npm run db:migrate     # terapkan skema ke PostgreSQL lokal
npm run db:seed        # seed 3 role tetap
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
| `npm run db:seed`     | Seed data referensi (3 role tetap)          |
| `npm run db:studio`   | Buka Prisma Studio                          |

## Struktur Proyek

Lihat [docs/architecture.md](docs/architecture.md#struktur-proyek) untuk
penjelasan lengkap tiap folder dan alasannya.

## Dokumentasi

- [docs/architecture.md](docs/architecture.md) — arsitektur, layering, kontrak API, prinsip keuangan
- [docs/development.md](docs/development.md) — panduan setup & alur kerja pengembangan
- [docs/decisions.md](docs/decisions.md) — catatan keputusan teknis per phase
- [docs/deployment.md](docs/deployment.md) — panduan deploy production (PHASE 12)
- [docs/step1/00-progress.md](docs/step1/00-progress.md) — checklist penerimaan PHASE 1
- [docs/step2/00-progress.md](docs/step2/00-progress.md) — checklist penerimaan PHASE 2
- [docs/step3/00-progress.md](docs/step3/00-progress.md) — checklist penerimaan PHASE 3
- [docs/step4/00-progress.md](docs/step4/00-progress.md) — checklist penerimaan PHASE 4
- [docs/step5/00-progress.md](docs/step5/00-progress.md) — checklist penerimaan PHASE 5
- [docs/step6/00-progress.md](docs/step6/00-progress.md) — checklist penerimaan PHASE 6
- [docs/step7/00-progress.md](docs/step7/00-progress.md) — checklist penerimaan PHASE 7
- [docs/step8/00-progress.md](docs/step8/00-progress.md) — checklist penerimaan PHASE 8
- [docs/step9/00-progress.md](docs/step9/00-progress.md) — checklist penerimaan PHASE 9
- [docs/step10/00-progress.md](docs/step10/00-progress.md) — checklist penerimaan PHASE 10
- [docs/step11/00-progress.md](docs/step11/00-progress.md) — checklist penerimaan PHASE 11
- [docs/step12/00-progress.md](docs/step12/00-progress.md) — checklist penerimaan PHASE 12 (final)
