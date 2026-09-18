# Catatan Keputusan Teknis (ADR ringkas)

Format: keputusan → alasan. Hanya keputusan yang tidak trivial/tidak diatur
eksplisit oleh spesifikasi SIKEP dicatat di sini.

## PHASE 1 — Foundation

**D1. Scaffold dengan `create-next-app` (App Router, Tailwind v4, ESLint),
lalu disesuaikan manual untuk layering domain.**
Alasan: baseline resmi Next.js paling stabil untuk App Router + Tailwind v4
(CSS-first config, tanpa `tailwind.config.js`); struktur `services/`,
`repositories/`, `types/`, `constants/` ditambahkan manual di atasnya sesuai
layering yang diwajibkan spesifikasi.

**D2. Pin `prisma` CLI ke `7.10.0` agar sama persis dengan `@prisma/client`.**
Alasan: `npm install -D prisma` awalnya menarik `8.0.0-rc.x` (release
candidate) sementara `@prisma/client` stabil di `7.10.0` — version skew
antara CLI dan client berisiko pada `prisma generate`/`migrate` di PHASE 2.
Dipin ke versi stabil yang sama.

**D3. Model database belum dibuat di `prisma/schema.prisma`.**
Alasan: sesuai urutan phase, `PHASE 2 — DATABASE` yang membangun seluruh
model (`schools`, `users`, `santri`, `financial_ledger`, dst). PHASE 1 hanya
menyiapkan koneksi (`datasource`/`generator`) agar `prisma generate` bisa
dijalankan tanpa error.

**D4. Konstanta domain (role, kelas K1-K6/Pengabdian, jenis tagihan) TIDAK
dibuat sebagai hard-coded constants di `constants/`.**
Alasan: spesifikasi eksplisit melarang financial logic hard-coded
berdasarkan nama tagihan/role, dan mewajibkan role/kelas/jenis tagihan
sebagai master data configurable di database. `constants/app.ts` hanya
berisi konstanta infrastruktur (nama app, currency, timezone, API version).

**D5. Logger memakai Pino, bukan `console.*`.**
Alasan: dibutuhkan structured logging (JSON) dengan redaksi field sensitif
(password/token/secret) untuk memenuhi aturan keamanan audit-friendly di
PHASE 9/10, dan agar log bisa di-pipe ke agregator di production.

**D6. Test framework: Vitest, bukan Jest.**
Alasan: setup lebih ringan untuk proyek Next.js App Router + TypeScript ESM,
tanpa konfigurasi transform tambahan. Unit test PHASE 1 menguji kode
foundation yang nyata (`lib/errors.ts`, `lib/api-response.ts`,
`lib/env.ts`, `constants/app.ts`), bukan test dummy.

**D7. `shadcn/ui` disiapkan sebagai foundation (`components.json`,
`lib/utils.ts` / `cn()`, dependency `clsx`+`tailwind-merge`+
`class-variance-authority`+`lucide-react`) tanpa menarik komponen UI
konkret.**
Alasan: komponen ditambahkan per modul saat modul tersebut dikerjakan
(mulai PHASE 4+), sesuai aturan "jangan membangun scope melebar" — foundation
hanya menyiapkan jalur agar `npx shadcn add <komponen>` langsung bisa jalan.

**D8. Auth.js / NextAuth belum diinstal di PHASE 1.**
Alasan: `PHASE 3 — AUTH + RBAC` adalah pemilik desain autentikasi (strategi
session, Argon2id, cookie policy). `.env.example` sudah menyiapkan slot
`AUTH_SECRET` agar tidak ada perubahan skema env yang mengejutkan nanti.

**D9. 4 kerentanan `npm audit` (severity high) diterima sementara —
seluruhnya transitif dari `prisma` CLI (devDependency), tidak ter-expose
ke runtime/production.**

Rincian per 2026-09-18:

| Package | Kerentanan | Sumber |
|---|---|---|
| `mysql2` | Auth plugin downgrade dapat membocorkan credential plaintext (GHSA-3f6p-5ww8-9rcr) | Dibundel `prisma` CLI untuk introspeksi/migrasi MySQL — proyek ini memakai PostgreSQL, driver ini tidak pernah dipanggil kode kita |
| `deepmerge-ts` | Stack exhaustion pada merge objek rekursif (GHSA-ggr8-5vv4-36mx) | Dipakai `@prisma/config` saat memuat `prisma.config.ts` — input berasal dari file config milik developer, bukan dari user/attacker |

Keduanya berada di rantai dependency `prisma` (CLI, devDependency untuk
`generate`/`migrate`/`studio`), **bukan** `@prisma/client`/`@prisma/adapter-pg`/`pg`
yang dipakai runtime aplikasi (`lib/prisma.ts`) — tidak ikut ter-bundle ke
`.next/` production build.

`npm audit fix --force` yang ditawarkan npm sebenarnya adalah **downgrade
mayor** `prisma` ke `6.19.3`, bukan upgrade — itu akan mengembalikan pola
`datasource.url` lama yang sudah sengaja kita tinggalkan (lihat D2) dan
kontradiktif dengan arsitektur driver-adapter Prisma 7 yang sudah
diimplementasikan & diuji. Downgrade mayor tanpa alasan kuat lebih
berisiko daripada kerentanan dev-tooling yang tidak ter-expose ini.

Keputusan: diterima sementara, tidak di-downgrade. Ditinjau ulang setiap
kali `prisma` merilis versi patch baru (`npm outdated prisma` /
`npm audit`) — bukan diam-diam diabaikan.

**D10. (Ditemukan saat FINAL REVIEW) `.gitignore` bawaan `create-next-app`
memakai pola `.env*` yang turut meng-ignore `.env.example`.**
Alasan: `.env.example` adalah template tanpa secret dan harus ikut
di-commit supaya developer/CI lain tahu variabel env yang dibutuhkan.
Diperbaiki dengan menambah baris `!.env.example` setelah `.env*` di
`.gitignore` — `.env` (dan varian nyata lain seperti `.env.local`) tetap
ter-ignore, hanya `.env.example` yang dikecualikan.
