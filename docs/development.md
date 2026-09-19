# Panduan Pengembangan

## Prasyarat

- Node.js 20+ (dikembangkan dengan Node 24)
- PostgreSQL 15+ (lokal atau container)

## Setup Awal

```bash
npm install
cp .env.example .env
# isi DATABASE_URL mengarah ke PostgreSQL lokal, dan AUTH_SECRET (wajib,
# minimal 32 karakter):
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npm run db:migrate    # atau: prisma migrate deploy (lihat bagian Database)
npm run db:seed       # seed 3 role tetap (ADMIN/BENDAHARA/YAYASAN)
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

`npm run typecheck` menjalankan `next typegen` terlebih dulu — tipe route
Next.js (mis. `LayoutProps<"/">`) di-generate ke `.next/types` (gitignored)
dan sebelumnya hanya dibuat oleh `next dev`/`next build`, sehingga
`tsc --noEmit` gagal di clone/CI baru tanpa langkah ini.

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
  lewat `services/AuditService.ts` (`recordAudit`) — sudah berjalan sejak
  PHASE 5 untuk mutasi keuangan, bukan menunggu PHASE 9. PHASE 9
  (RECONCILIATION + AUDIT) menambahkan UI/laporan untuk MELIHAT audit log
  ini, bukan mulai menulisnya.

## Testing

- `tests/unit/**` — unit test murni (Vitest), satu file per
  service/repository/lib, semua dependency di-mock di batas modul.
- `tests/integration/**` (PHASE 11) — memanggil service function ASLI
  (bukan mock) dengan repository/prisma di-mock secara STATEFUL untuk
  mensimulasikan skenario lintas-layer:
  - `financial-integrity.test.ts` — skenario wajib spec section 18 (saldo
    Rp1.000.000, dua expense Rp700.000, tidak boleh saldo negatif),
    dijalankan lewat `ExpenseService.submitExpense` asli.
  - `concurrency.test.ts` — dua keputusan approval / dua penutupan
    periode "bersamaan" (`Promise.all`) lewat `ApprovalService`/
    `FinancialPeriodService` asli — tepat satu pemenang, yang kalah
    `ConflictError`.
  - `idempotency.test.ts` — retry sekuensial dan retry balapan (race)
    dengan `Idempotency-Key` yang sama lewat `IncomeService.recordIncome`
    asli — tidak pernah double-post.
  - `security.test.ts` — route handler `GET`/`POST` ASLI (diimpor
    langsung dari `app/api/v1/**/route.ts`) dipanggil dengan
    `NextRequest` sungguhan; `requireCsrf`/`verifyCsrfToken` berjalan
    nyata (hanya titik baca cookie yang di-mock, D67).
  - **Batasan yang disadari (D66)**: tidak ada PostgreSQL nyata di
    lingkungan ini — isolasi transaksi `Serializable` PostgreSQL sendiri
    (yang mencegah commit ganda sungguhan) TIDAK diuji ulang di sini
    (itu tanggung jawab PostgreSQL, sudah terverifikasi luas secara
    eksternal); yang diuji adalah LOGIKA kode kita di atasnya.
- Jalankan: `npm run test` (sekali), `npm run test:watch` (mode watch),
  atau `npm run test:coverage` (laporan coverage `text`+`html` ke
  `coverage/`, di-gitignore). `app/**`/`components/**` sengaja
  dikecualikan dari coverage (D69) — tidak ada rendering test React di
  proyek ini (`environment: "node"`, bukan `jsdom`).

## Database (Prisma)

- Schema di `prisma/schema.prisma` — 26 tabel domain PHASE 2 (lihat
  `docs/architecture.md#skema-database-phase-2` dan `docs/decisions.md`
  D11-D17 untuk detail & alasan desain).
- `npm run db:generate` — generate Prisma Client setelah schema berubah.
- **Migration awal sudah dibuat & di-commit**:
  `prisma/migrations/20260918000000_init/migration.sql`. Ini dibuat tanpa
  PostgreSQL nyata (lingkungan pengembangan awal tidak punya
  Docker/Postgres), lewat:
  ```bash
  npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
  ```
  Migration ini berisi satu `CHECK` constraint yang ditambah manual (bukan
  dari Prisma) — lihat D16 sebelum menjalankan `prisma migrate dev` lagi di
  tabel `approval_requests`, supaya constraint itu tidak ter-drop tanpa
  sengaja oleh diff berikutnya.
- **Begitu Anda punya PostgreSQL nyata** (`DATABASE_URL` di `.env` mengarah
  ke server yang benar-benar berjalan): jalankan
  `npx prisma migrate resolve --applied 20260918000000_init` sekali (supaya
  Prisma tahu migration ini sudah "diterapkan" secara manual sesuai isi
  filenya) — atau, jika database masih benar-benar kosong, langsung
  `npx prisma migrate deploy` untuk mengeksekusi SQL-nya.
- `npm run db:migrate` — buat & jalankan migration BARU (dev only,
  butuh PostgreSQL nyata berjalan — akan gagal tanpa itu).
- `npm run db:studio` — buka Prisma Studio untuk inspeksi data lokal
  (butuh PostgreSQL nyata berjalan).

## Auth (PHASE 3)

- Login: `POST /api/v1/auth/login` `{ email, password }` → set cookie
  `sikep_session` (HttpOnly) + `sikep_csrf`. Halaman: `/login`.
- Logout: `POST /api/v1/auth/logout`, **wajib** header
  `X-CSRF-Token: <nilai cookie sikep_csrf>` (double-submit CSRF, lihat
  `lib/auth/csrf.ts`) — lihat `components/LogoutButton.tsx` untuk contoh.
  Setiap endpoint mutating baru (PHASE 5+) wajib memanggil
  `verifyCsrfToken` yang sama.
- Cek sesi: `GET /api/v1/auth/me`.
- Ada UI manajemen user di `/admin/users` (PHASE 4) — tapi user PERTAMA di
  sekolah pertama tetap harus dibuat manual (belum ada yang bisa login
  untuk membuatnya lewat UI). Setelah `db:seed` mengisi tabel `roles`, dan
  setelah ada baris `schools`:
  ```ts
  // jalankan lewat: npx tsx -e "..." atau script sekali-pakai
  import { createPasswordHash } from "./services/AuthService";
  console.log(await createPasswordHash("password-anda"));
  ```
  lalu `INSERT` baris ke tabel `users` (lewat Prisma Studio/`db:studio`)
  dengan `password_hash` hasil di atas dan `role_id` yang sesuai (role
  `ADMIN`) — **jangan pernah** menyimpan password plaintext, bahkan untuk
  data development.

## Master Data (PHASE 4)

Semua endpoint di bawah butuh login sebagai `ADMIN` untuk mutasi (POST/
PATCH/DELETE); GET bisa diakses role manapun. Semua mutasi butuh header
`X-CSRF-Token` (dipenuhi otomatis oleh `lib/client/api.ts` di sisi client).

- `GET/POST /api/v1/master-data/{entity}` dan
  `PATCH/DELETE /api/v1/master-data/{entity}/{id}` — `entity` salah satu
  dari `academic-years`, `classes`, `financial-accounts`, `fund-sources`,
  `transaction-categories`, `bill-types` (lihat
  `lib/master-data/entities.ts`). UI: `/admin/master-data/{entity}`.
- `GET/POST /api/v1/santri`, `PATCH/DELETE /api/v1/santri/{id}`. UI:
  `/admin/santri`.
- `GET/POST /api/v1/users`, `PATCH/DELETE /api/v1/users/{id}`
  (`roleCode` salah satu dari `ROLE_CODES`). UI: `/admin/users`.
- `GET/PATCH /api/v1/settings/approval` — threshold approval pengeluaran
  & `allowNegativeBalance`. UI: `/admin/settings`.

**Seed jenis tagihan default** (12 item, spec section 5) tidak otomatis —
`bill_types` tenant-scoped, jadi butuh `school_id` yang sudah ada:

```bash
SEED_SCHOOL_ID=<uuid-sekolah> npm run db:seed
```

Tanpa `SEED_SCHOOL_ID`, `db:seed` hanya mengisi tabel `roles` (aman
dijalankan berkali-kali, idempotent lewat `upsert`).

## Financial Engine (PHASE 5)

Hanya role `BENDAHARA` yang bisa POST/void (D38); GET terbuka untuk
role manapun yang login.

- `GET/POST /api/v1/income`, `POST /api/v1/income/{id}/void`.
- `GET/POST /api/v1/expenses`, `POST /api/v1/expenses/{id}/void`.
  Response `POST /api/v1/expenses` bisa `status: "POSTED"` (langsung ke
  ledger) atau `status: "PENDING_APPROVAL"` (menunggu PHASE 7) tergantung
  threshold — lihat `expenseApprovalThreshold` di `/api/v1/settings/approval`.
- Body `POST` kedua endpoint: `{ financialAccountId, categoryId,
(fundSourceId untuk income), amount: "500000.00", transactionDate,
description? }`. `amount` string desimal, bukan number.
- Body `POST .../void`: `{ reason: "..." }` — wajib diisi.
- **Idempotency-Key**: kirim header `Idempotency-Key: <uuid-acak-dari-client>`
  pada `POST /api/v1/income` atau `/api/v1/expenses` untuk aman di-retry
  (mis. saat koneksi terputus setelah request terkirim tapi sebelum
  response diterima) — request kedua dengan key yang sama mengembalikan
  hasil yang sama (`replayed: true` di response), bukan transaksi ganda.

Saldo akun HANYA bisa dilihat lewat kode (`services/LedgerService.ts`
`getAccountBalance`) — belum ada endpoint `GET /api/v1/financial-accounts/{id}/balance`
di PHASE 5 (kandidat PHASE 8 Dashboard, atau tambahkan sekarang kalau
dibutuhkan lebih awal).

## Billing & Payment (PHASE 6)

Hanya role `BENDAHARA` yang bisa POST/void; GET terbuka untuk role
manapun yang login.

- `GET/POST /api/v1/santri-bills?santriId=` — tagihan individual. Body
  `POST`: `{ santriId, billTypeId, academicYearId, amount, dueDate?, description? }`.
- `POST /api/v1/santri-bills/bulk` — tagihan massal. Body:
  `{ santriIds: [...], billTypeId, academicYearId, amount, dueDate?, description? }`.
- `GET/POST /api/v1/santri-payments?santriId=`, `POST /api/v1/santri-payments/{id}/void`.
  Body `POST`: `{ santriId, financialAccountId, fundSourceId, categoryId,
amount, paymentDate, referenceNo?, note?, billIds?: [...] }`.
  `billIds` boleh kosong (D41) → seluruh jumlah jadi kredit (deposit di
  muka). Kalau diisi, alokasi otomatis ke tagihan yang jatuh tempo lebih
  dulu (D40) — sisa (jika ada, overpayment) otomatis jadi kredit.
  Mendukung header `Idempotency-Key` sama seperti income/expense.
- `POST /api/v1/santri-credits/apply` — pakai kredit yang sudah ada untuk
  melunasi satu tagihan. Body: `{ santriId, billId, amount }`.
- `GET /api/v1/santri/{id}/credit-balance` — saldo kredit + histori.

`voidPayment` menolak (403) kalau kredit yang diterbitkan pembayaran itu
sudah terpakai sebagian oleh pembayaran/tagihan lain (D43) — pesan error
menjelaskan kenapa.

## Approval (PHASE 7)

Hanya role `YAYASAN` yang bisa approve/reject; GET terbuka untuk role
manapun yang login. Creator (Bendahara yang submit) tidak bisa
memutuskan pengajuannya sendiri — akan mendapat 403 yang jelas kalau
mencoba.

- `GET /api/v1/approval-requests?status=PENDING|APPROVED|REJECTED` —
  tanpa `status`, mengembalikan semua.
- `POST /api/v1/approval-requests/{id}/approve` — tidak butuh body.
  Mem-posting expense ke ledger (bisa gagal dengan `FINANCIAL_INTEGRITY_ERROR`
  kalau saldo akun sudah tidak cukup sejak submit).
- `POST /api/v1/approval-requests/{id}/reject` — body `{ reason }` wajib.

Pengeluaran yang ditolak berhenti di status `REJECTED` — belum ada
endpoint untuk mengedit & resubmit (D46, di luar scope PHASE 7).

## Dashboard & Laporan (PHASE 8)

Semua endpoint di bawah GET-only, terbuka untuk role manapun yang login
(D52) — murni ringkasan/laporan, tidak ada mutasi.

- `GET /api/v1/dashboard/summary` — saldo per akun + total, pemasukan/
  pengeluaran bulan berjalan, jumlah approval pending, ringkasan status
  tagihan santri, tren 6 bulan (Recharts), 10 transaksi terbaru. UI:
  `/dashboard`.
- `GET /api/v1/reports/financial?from=YYYY-MM-DD&to=YYYY-MM-DD` — `to`
  inklusif di query (server menggeser ke eksklusif secara internal).
  Pemasukan/pengeluaran `POSTED` dikelompokkan per kategori.
- `GET /api/v1/reports/financial/export?from=&to=&format=pdf|xlsx` —
  mengunduh file, mencatat audit `EXPORT` (D50).
- `GET /api/v1/reports/billing?academicYearId=&classId=&status=` — semua
  filter opsional. Satu baris per `santri_bills`, memakai cache
  `amountPaid` yang sudah dijaga `PaymentService` (bukan hitung ulang).
- `GET /api/v1/reports/billing/export?...&format=pdf|xlsx` — sama seperti
  di atas, plus audit `EXPORT`.

UI `/laporan` memanggil endpoint export lewat `<a href>` biasa (GET, tidak
butuh header CSRF — hanya mutasi POST/PATCH/DELETE yang butuh itu).

Tren bulanan & rentang tanggal laporan memakai batas kalender UTC, bukan
konversi Asia/Jakarta yang sesungguhnya (D53) — konsisten dengan bagian
lain aplikasi yang juga belum melakukan konversi timezone eksplisit untuk
batas tanggal.

## Rekonsiliasi & Audit (PHASE 9)

- `GET/POST /api/v1/financial-periods` — GET untuk role manapun yang
  login; POST (`{ name, startDate, endDate, academicYearId? }`) hanya
  `BENDAHARA` (D58). Menolak rentang tanggal yang bertabrakan dengan
  periode lain (D59, `ConflictError`).
- `POST /api/v1/financial-periods/{id}/close` — hanya `BENDAHARA`. Body:
  `{ balances: [{ financialAccountId, actualBalance }, ...] }` — WAJIB
  mencakup persis semua akun keuangan aktif sekolah (tidak boleh sebagian
  atau berlebih), atau gagal dengan `VALIDATION_ERROR`/`NOT_FOUND`.
  Response menyertakan `reconciliation` (saldo sistem vs aktual + selisih
  per akun). Tidak ada endpoint untuk membuka kembali periode yang sudah
  ditutup (D56, satu arah).
- Setelah sebuah periode `CLOSED`, mencatat pemasukan/pengeluaran BARU
  (`POST /api/v1/income`, `POST /api/v1/expenses`, `POST
/api/v1/santri-payments`) dengan `transactionDate`/`paymentDate` di
  dalam rentang periode itu akan ditolak dengan
  `FINANCIAL_INTEGRITY_ERROR` (D57). Void/reversal transaksi lama tetap
  bisa dilakukan kapan pun — baris `REVERSAL` selalu bertanggal hari ini.
- `GET /api/v1/audit-logs?action=&entityType=&userId=&from=&to=&page=&pageSize=` —
  hanya `ADMIN` dan `YAYASAN` (D58). Membaca `audit_logs` yang sudah
  ditulis `services/AuditService.ts` sejak PHASE 5 — endpoint ini TIDAK
  menambah penulisan audit baru, murni jendela baca dengan
  filter/paginasi (`page`/`pageSize`, default 1/50, maksimal 200 per
  halaman).

UI: `/rekonsiliasi` (Bendahara) dan `/audit` (Admin/Yayasan).

## Security Hardening (PHASE 10)

- `lib/security-headers.ts` — `getSecurityHeaders(isDev)` dan
  `buildContentSecurityPolicy(isDev)`, dipasang ke SEMUA response lewat
  `next.config.ts` `headers()`. Header: `Content-Security-Policy`,
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`
  (production only, D65). CSP statis tanpa nonce (D61).
- `next.config.ts` juga men-set `poweredByHeader: false` — header
  `X-Powered-By: Next.js` tidak lagi dikirim.
- PHASE 10 TIDAK menambah rute/service/UI baru — murni audit + satu
  penambahan konfigurasi (security headers). Hasil audit CSRF/RBAC/IDOR
  didokumentasikan di `docs/architecture.md` bagian "Audit Keamanan
  PHASE 10" dan `docs/decisions.md` D61-D65 — semuanya konfirmasi
  ("sudah benar sejak phase sebelumnya"), tidak ada bug yang diperbaiki.
- `npm audit` diverifikasi ulang (D62) — temuan sama seperti PHASE 8,
  tidak ada yang baru; tidak diperbaiki paksa (breaking change,
  butuh persetujuan eksplisit).

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

## Production (PHASE 12)

Untuk deploy ke production — env var wajib, urutan `npm ci`/migrate/
build/start, health check (`GET /api/v1/health`), dan keterbatasan yang
disadari (rate limiting multi-instance, D19) — lihat
[docs/deployment.md](deployment.md), bukan file ini (file ini fokus ke
setup development lokal).
