# Panduan Pengembangan

## Prasyarat

- Node.js 20+ (dikembangkan dengan Node 24)
- PostgreSQL 15+ (lokal atau container)

## Setup Awal

```bash
npm install
cp .env.example .env
# isi DATABASE_URL mengarah ke PostgreSQL lokal
npm run dev
```

## Alur Kerja Sebelum Commit

```bash
npm run lint
npm run typecheck
npm run test
npm run format:check
```

Semua harus hijau. `npm run build` juga harus sukses sebelum sebuah phase
dianggap selesai (lihat Quality Gate di spesifikasi SIKEP).

## Konvensi Kode

- TypeScript **strict** — sudah aktif di `tsconfig.json`, jangan dimatikan.
- Validasi input dengan **Zod** di batas sistem (API route/server action),
  bukan di dalam service.
- Mutasi keuangan **wajib** lewat `services/*Service.ts` dan **wajib**
  dibungkus `prisma.$transaction(...)`.
- Jangan membuat file/komponen raksasa — pisahkan per tanggung jawab
  (lihat `docs/architecture.md` untuk layering).
- Gunakan `lib/errors.ts` (`AppError` dan turunannya) untuk error yang
  diharapkan; error tak terduga otomatis ditangani sebagai 500 oleh
  `handleApiError` di `lib/api-response.ts`.
- Setiap aksi kritikal (CREATE/UPDATE/SUBMIT/APPROVE/REJECT/POST/VOID/
  REVERSAL/LOGIN/LOGOUT/EXPORT/CONFIG_CHANGE) harus tercatat di audit log
  (diimplementasikan PHASE 9).

## Testing

- `tests/unit/**` — unit test murni (Vitest), tanpa database.
- `tests/integration/**` — ditambahkan mulai PHASE 5/6 saat ada database
  nyata untuk diuji (termasuk concurrency & idempotency test untuk
  financial engine).
- Jalankan: `npm run test` (sekali) atau `npm run test:watch` (mode watch).

## Database (Prisma)

- Schema di `prisma/schema.prisma`. Model domain ditambahkan mulai PHASE 2.
- `npm run db:generate` — generate Prisma Client setelah schema berubah.
- `npm run db:migrate` — buat & jalankan migration (dev only).
- `npm run db:studio` — buka Prisma Studio untuk inspeksi data lokal.

## Menambahkan Komponen shadcn/ui

`components.json` sudah dikonfigurasi (style `new-york`, base color `zinc`,
alias `@/components`, `@/lib`, `@/hooks`). Tambahkan komponen sesuai
kebutuhan modul saat modul tersebut dikerjakan:

```bash
npx shadcn@latest add button
```

## Environment Variables

Lihat `.env.example` untuk daftar lengkap. Jangan pernah commit `.env`
(sudah di-ignore lewat `.gitignore`). Validasi runtime ada di
`lib/env.ts` — aplikasi gagal start dengan pesan jelas jika env tidak valid.
