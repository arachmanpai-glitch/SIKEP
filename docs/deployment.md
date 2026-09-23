# Deployment ke Production (PHASE 12)

Panduan ini melengkapi `docs/development.md` (setup lokal) — fokus di sini
adalah menjalankan SIKEP di lingkungan production sungguhan.

## Prasyarat Infrastruktur

- **PostgreSQL 15+** — terpisah dari database development/test, dengan
  backup terjadwal. SIKEP tidak menyediakan mekanisme backup sendiri
  (di luar scope 12 phase resmi) — ini tanggung jawab operasional.
- **Reverse proxy / load balancer dengan TLS** (nginx, Caddy, atau
  layanan cloud setara) — SIKEP sendiri TIDAK melakukan TLS termination.
  Header `Strict-Transport-Security` (PHASE 10) mengasumsikan lalu lintas
  sudah HTTPS di titik ini (lihat `docs/decisions.md` D65).
- **Node.js 20+** (dikembangkan dengan Node 24) untuk menjalankan
  `next start`.

## Environment Variables (Wajib)

Lihat `.env.example` untuk daftar lengkap. Yang WAJIB diisi di production
(aplikasi gagal start dengan pesan jelas lewat `lib/env.ts` jika tidak):

| Variabel       | Keterangan                                                                                                                                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`     | Harus `production` — mengaktifkan cookie `Secure`, header `Strict-Transport-Security` (D65), dan CSP tanpa `unsafe-eval` (D61).                                                                                                                                              |
| `DATABASE_URL` | Connection string PostgreSQL production.                                                                                                                                                                                                                                     |
| `AUTH_SECRET`  | Minimal 32 karakter, ACAK, BEDA dari development/staging. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Jangan pernah pakai ulang secret antar environment** — kebocoran satu environment tidak boleh membuka environment lain. |
| `APP_URL`      | URL publik aplikasi (dipakai untuk link, dsb).                                                                                                                                                                                                                               |
| `LOG_LEVEL`    | Disarankan `info` di production (`debug`/`trace` bisa membocorkan detail berlebihan ke log meski `lib/logger.ts` sudah redact field sensitif, D5).                                                                                                                           |

Opsional (punya default aman di `lib/env.ts`, lihat D75/D79 untuk
alasan desainnya):

| Variabel                         | Default                 | Keterangan                                                                                                                                                                                                                      |
| -------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ATTACHMENT_STORAGE_DIR`         | `./storage/attachments` | Direktori disk PRIVAT untuk lampiran "Bukti Transaksi" — **HARUS** di luar `public/` dan idealnya di volume persisten (bukan ephemeral container filesystem) kalau redeploy tidak boleh menghapus evidence yang sudah diunggah. |
| `ATTACHMENT_MAX_FILE_SIZE_BYTES` | `10000000` (10 MB)      | Batas ukuran satu file lampiran.                                                                                                                                                                                                |

## Urutan Deploy

```bash
npm ci                          # install exact locked versions (bukan npm install) — postinstall (D87) otomatis jalankan `prisma generate`
npx prisma migrate deploy       # terapkan semua migration ke database production
npm run build
npm run start
```

Catatan: instruksi lama di sini pernah menyebut `prisma migrate resolve
--applied 20260918000000_init` sebagai langkah wajib SEKALI di database
pertama — itu spekulasi dari PHASE 2 (ditulis sebelum ada PostgreSQL
sungguhan untuk diuji). Sudah dibuktikan TIDAK PERLU: `prisma migrate
deploy` biasa berhasil menerapkan migration pertama ke database kosong
tanpa trik apa pun (diverifikasi nyata saat deploy production pertama,
2026-09-23, D89).

`npm run db:seed` (seed 3 role tetap) lalu `scripts/bootstrap-admin.ts`
(D88, buat sekolah + ADMIN pertama sekaligus) wajib dijalankan sekali di
database production yang benar-benar baru — lihat `docs/development.md`
bagian Auth (PHASE 3) untuk detail & contoh perintahnya.

## Health Check (PHASE 12)

`GET /api/v1/health` — publik (tanpa login), untuk load balancer/process
manager/uptime monitor. Mengecek konektivitas database (`SELECT 1`),
BUKAN endpoint bisnis — responsnya sengaja BUKAN format envelope standar
`{success,data,message}` (lihat `docs/decisions.md` D70):

```json
// 200 OK
{ "status": "ok", "checks": { "database": "ok" } }

// 503 Service Unavailable
{ "status": "error", "checks": { "database": "error" } }
```

## Proses & Restart

SIKEP TIDAK menyertakan process manager sendiri — jalankan `npm run
start` di belakang systemd/PM2/container orchestrator yang me-restart
otomatis kalau proses mati, dan arahkan health check orchestrator itu ke
`GET /api/v1/health`.

## Rate Limiting Multi-Instance (Keterbatasan yang Disadari)

`lib/auth/rate-limit.ts` (PHASE 3) menyimpan state di memori proses
(`Map` in-process) — SUDAH didokumentasikan sejak D19 bahwa ini reset
saat restart dan TIDAK konsisten lintas instance kalau SIKEP dijalankan
lebih dari satu instance (horizontal scaling) di belakang load balancer.
Untuk deployment single-instance, ini tidak masalah. Untuk multi-instance,
ganti dengan store bersama (Redis, dsb) — di luar scope 12 phase resmi,
dicatat sebagai kandidat peningkatan pasca-PHASE 12 kalau/ketika
deployment multi-instance dibutuhkan.

## Deploy Production Pertama: Vercel + Neon (Tier Gratis, 2026-09-23)

Deploy sungguhan pertama SIKEP (Pesantren Modern Al-Jumhuriyah) memakai
kombinasi gratis-selamanya ini, bukan VPS manual — dipilih atas
permintaan eksplisit pengguna (D89), bukan direkomendasikan sebagai
satu-satunya cara. Ringkasan langkahnya (detail alasan tiap keputusan:
`docs/decisions.md` D87-D89):

1. **Neon** (Postgres gratis) — project Neon **HARUS dibuat lewat tab
   Storage di dashboard project Vercel** (Create Database → Neon), BUKAN
   dari dashboard neon.tech langsung, kalau akun Neon-nya sendiri dibuat
   lewat integrasi Vercel (dashboard neon.tech akan menolak tombol "New
   Project" dengan pesan mengarahkan ke Vercel). Hasilnya: satu database
   Neon baru, terhubung otomatis, `DATABASE_URL`/`DATABASE_URL_UNPOOLED`
   terisi otomatis sebagai environment variable Vercel.
2. **Vercel** (hosting) — `npx vercel login` lalu `npx vercel link
--yes` dari root repo untuk membuat & menyambungkan project.
   Environment variable lain (`AUTH_SECRET`, `APP_URL`, `LOG_LEVEL`)
   ditambahkan lewat `npx vercel env add <NAMA> production --value
"<nilai>" --yes`.
3. Migrasi + seed role + bootstrap ADMIN pertama dijalankan SEKALI
   secara manual dari lokal, menunjuk `DATABASE_URL` production (bukan
   pooled/`-pooler` — pakai `DATABASE_URL_UNPOOLED` untuk
   `migrate deploy`, migration butuh koneksi langsung):
   ```bash
   DATABASE_URL="<DATABASE_URL_UNPOOLED dari Neon>" npx prisma migrate deploy
   DATABASE_URL="<url yang sama>" npx tsx prisma/seed.ts
   DATABASE_URL="<url yang sama>" BOOTSTRAP_SCHOOL_NAME="..." BOOTSTRAP_ADMIN_EMAIL="..." BOOTSTRAP_ADMIN_PASSWORD="..." npx tsx scripts/bootstrap-admin.ts
   ```
4. `npx vercel deploy --prod --yes` — deploy pertama GAGAL karena D87
   (Prisma Client belum ter-generate di mesin build Vercel); setelah
   `postinstall` ditambahkan, deploy kedua sukses.
5. Diverifikasi nyata: `GET /api/v1/health` merespons `{"status":"ok"}`,
   login ADMIN sungguhan berhasil di URL production, dashboard
   menampilkan state kosong yang benar (bukan error) untuk database yang
   benar-benar baru.

**Konsekuensi yang diterima sadar untuk kombinasi ini (D89)**: modul
"Bukti Transaksi" (upload lampiran) TIDAK berfungsi andal di Vercel —
lihat bagian gap di bawah.

## Gap yang Disadari (Belum Diimplementasikan)

Dicatat secara eksplisit supaya tidak disalahartikan sebagai celah yang
terlewat:

- **Private object storage di platform serverless (mis. Vercel)** —
  `lib/storage/attachment-storage.ts` (D75) memakai disk lokal, yang
  cocok untuk deployment VPS/container persisten tapi TIDAK persisten di
  fungsi serverless Vercel (setiap invocation bisa dapat filesystem
  berbeda). Upload lampiran mungkin gagal/hilang di deployment Vercel.
  Perbaikan: ganti `lib/storage/attachment-storage.ts` dengan adapter
  S3-compatible sungguhan (Cloudflare R2 cocok — tier gratis, tanpa
  biaya egress) — abstraksinya sudah didesain agar penggantian ini tidak
  mengubah pemanggilnya (`services/AttachmentService.ts`). Kandidat
  instruksi eksplisit terpisah, belum dikerjakan per 2026-09-23.

Sudah diisi (bukan lagi gap, disebut di sini supaya riwayatnya jelas):

- **E2E test** (Playwright) — diisi 2026-09-20, lihat
  `docs/step11/00-progress.md` dan `docs/decisions.md` D81-D85.
- **Private object storage / signed URL** (modul "Bukti Transaksi") —
  tidak pernah dijadwalkan di salah satu dari 12 nama phase resmi
  (lihat `docs/step10/00-progress.md`), diisi 2026-09-20 lewat instruksi
  eksplisit terpisah. Storage disk lokal privat (BUKAN S3 sungguhan —
  tidak ada kredensial cloud untuk verifikasi nyata di lingkungan ini),
  di belakang abstraksi yang bisa diganti S3 tanpa mengubah pemanggilnya
  (`docs/decisions.md` D75-D80). **Konsekuensi operasional**: pastikan
  `ATTACHMENT_STORAGE_DIR` (lihat tabel env var di atas) menunjuk ke
  volume persisten di production, bukan filesystem container ephemeral
  (lihat gap serverless di atas untuk kasus Vercel spesifik).
