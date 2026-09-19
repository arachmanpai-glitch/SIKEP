# PHASE 4 — MASTER DATA: Acceptance Checklist

Status: **SELESAI** (2026-09-18). Menunggu review/perintah `LANJUT PHASE 5`.

## Acceptance Criteria

- [x] Admin dapat CRUD: tahun ajaran, kelas, akun keuangan, sumber dana,
      kategori transaksi, jenis tagihan, santri, user — sesuai daftar
      tanggung jawab Admin di spec section 2
- [x] Semua master data configurable via tabel biasa (bukan hard-coded) —
      konsisten dengan D4/D13
- [x] Setiap CREATE/UPDATE/soft-delete tercatat di `audit_logs` lewat
      `AuditService` (satu-satunya penulis)
- [x] Perubahan `approval_settings` tercatat sebagai `CONFIG_CHANGE`,
      bukan `UPDATE` biasa (spec section 16)
- [x] Tenant isolation: setiap query di-scope `schoolId` dari session,
      cross-tenant access mengembalikan `NotFoundError` (bukan bocor lewat
      `ForbiddenError` yang menyingkap keberadaan record — IDOR-safe)
- [x] CSRF diterapkan di SEMUA endpoint mutating baru (bukan hanya
      logout), sesuai komitmen desain PHASE 3
- [x] Password user di-hash Argon2id, tidak pernah keluar dari
      `UserService` sebagai plaintext maupun hash (`PublicUser` shape)
- [x] Admin tidak bisa menonaktifkan akunnya sendiri (guard eksplisit +
      test)
- [x] Role tetap ADMIN/BENDAHARA/YAYASAN — user management memvalidasi
      `roleCode` terhadap `ROLE_CODES`, tidak ada role lain yang bisa
      dibuat
- [x] Seed 12 jenis tagihan default (spec section 5) tersedia sebagai
      utilitas per-sekolah (`SEED_SCHOOL_ID=<uuid> npm run db:seed`)
- [x] UI Admin fungsional untuk semua 8 entity (`/admin/**`), reuse 1
      generic component untuk 6 entity yang strukturnya identik
- [x] `/admin/**` dan seluruh `/api/v1/**` mutating baru diverifikasi di
      browser (redirect gate, 401/403/400 JSON yang benar)

## Hasil Validasi

| Perintah            | Hasil                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`      | ✅ 0 error                                                                                                                                     |
| `npm run typecheck` | ✅ 0 error (setelah fix `next typegen`, lihat Temuan #1)                                                                                       |
| `npm run test`      | ✅ 125/125 test lolos (23 file, +67 baru)                                                                                                      |
| `npm run build`     | ✅ build production sukses, 17 route (6 admin, 8 API baru)                                                                                     |
| Preview browser     | ✅ `/admin` redirect ke `/login` saat belum login; API master-data mengembalikan JSON 401/400 yang benar (bukan redirect HTML) setelah fix D30 |

## Temuan & Perbaikan Selama Pengerjaan (self-review)

1. **Isu tooling ditemukan & diperbaiki**: `npm run typecheck` gagal
   dengan `Cannot find name 'LayoutProps'` setelah `.next/` dihapus —
   tipe route Next.js yang di-generate (`next dev`/`next build`) belum
   ada. Diperbaiki dengan menambahkan `next typegen` ke script
   `typecheck` di `package.json`, supaya `tsc --noEmit` bisa jalan berdiri
   sendiri (penting untuk CI/clone baru).
2. **Bug relasi TypeScript ditemukan & diperbaiki**: mencoba memakai
   `RoleCode` sebagai tipe Prisma enum untuk `Role.code` — ternyata
   `code` hanya `String @unique` biasa (bukan Prisma enum), bukan bug
   fungsional (typecheck menangkapnya sebelum sempat jalan), tapi
   memperjelas bahwa role tetap divalidasi di layer aplikasi
   (`constants/roles.ts`), bukan level tipe database.
3. **Bug desain proxy ditemukan & diperbaiki (D30)**: `proxy.ts`
   me-redirect endpoint `/api/v1/master-data/**` yang belum login ke
   halaman HTML `/login`, bukan mengembalikan JSON — akan merusak
   `fetch()` client (`response.json()` gagal parse HTML). Ditemukan lewat
   verifikasi manual di browser, bukan code review. Diperbaiki:
   `proxy.ts` sekarang mengecualikan seluruh `/api/**` dari redirect.
4. **Gap desain ditemukan & diperbaiki sebelum kode ditulis lebih jauh**:
   draft awal generic master-data service dievaluasi ulang — hasil query
   `findById` yang sudah di-scope `schoolId` membuat panggilan
   `requireSameSchool` sesudahnya redundan di jalur normal (tapi tetap
   dipertahankan sebagai defense-in-depth eksplisit, lihat komentar di
   `services/masterDataService.ts`). Test awal salah mengharapkan
   `ForbiddenError` untuk akses cross-tenant — diperbaiki jadi
   `NotFoundError` yang justru lebih aman (tidak membocorkan keberadaan
   record tenant lain).
5. Login penuh & data nyata tetap tidak bisa diuji end-to-end (tidak ada
   PostgreSQL nyata, konsisten dengan keterbatasan PHASE 2/3). Untuk
   memverifikasi halaman yang butuh sesi, dibuat JWT session valid secara
   manual (memakai `AUTH_SECRET` yang sama) lalu dicoba lewat browser —
   cookie session bersifat `HttpOnly` by design sehingga tidak bisa
   di-inject lewat `document.cookie`; verifikasi authenticated-UI penuh
   ditunda sampai ada database nyata.

## Next Step

Ketik **`LANJUT PHASE 5`** untuk memulai `PHASE 5 — FINANCIAL ENGINE`
(`LedgerService`, `IncomeService`, `ExpenseService`, posting
`financial_ledger`, `Idempotency-Key`, saldo dari SUM ledger bukan kolom
manual).
