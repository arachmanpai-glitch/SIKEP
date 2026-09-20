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
npm ci                          # install exact locked versions (bukan npm install)
npm run db:generate             # generate Prisma Client
npx prisma migrate resolve --applied 20260918000000_init   # SEKALI SAJA, migration pertama (lihat docs/development.md)
npx prisma migrate deploy       # migration berikutnya (kalau ada)
npm run build
npm run start
```

`npm run db:seed` (seed 3 role tetap) wajib dijalankan sekali di database
production yang benar-benar baru — lihat `docs/development.md` bagian
Auth (PHASE 3) untuk cara membuat user ADMIN pertama secara manual (belum
ada UI self-registration, sesuai desain — semua user dibuat oleh Admin).

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

## Gap yang Disadari (Belum Diimplementasikan)

Dicatat secara eksplisit supaya tidak disalahartikan sebagai celah yang
terlewat:

- **E2E test** — butuh PostgreSQL nyata + Playwright/Cypress, tidak
  tersedia di lingkungan pengembangan manapun sepanjang PHASE 1-12
  (lihat `docs/step11/00-progress.md`). Masih terbuka per 2026-09-20 —
  kandidat instruksi eksplisit terpisah, sama seperti object
  storage/signed URL di bawah sebelum diisi.

Sudah diisi (bukan lagi gap, disebut di sini supaya riwayatnya jelas):

- **Private object storage / signed URL** (modul "Bukti Transaksi") —
  tidak pernah dijadwalkan di salah satu dari 12 nama phase resmi
  (lihat `docs/step10/00-progress.md`), diisi 2026-09-20 lewat instruksi
  eksplisit terpisah. Storage disk lokal privat (BUKAN S3 sungguhan —
  tidak ada kredensial cloud untuk verifikasi nyata di lingkungan ini),
  di belakang abstraksi yang bisa diganti S3 tanpa mengubah pemanggilnya
  (`docs/decisions.md` D75-D80). **Konsekuensi operasional**: pastikan
  `ATTACHMENT_STORAGE_DIR` (lihat tabel env var di atas) menunjuk ke
  volume persisten di production, bukan filesystem container ephemeral.
