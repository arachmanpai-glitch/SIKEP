# PHASE 2 — DATABASE: Acceptance Checklist

Status: **SELESAI** (2026-09-18). Menunggu review/perintah `LANJUT PHASE 3`.

## Acceptance Criteria

- [x] Seluruh 26 tabel minimum spesifikasi section 13 ada di
      `prisma/schema.prisma` (schools, roles, users, academic_years,
      classes, santri, financial_accounts, fund_sources,
      transaction_categories, bill_types, santri_bills, santri_payments,
      payment_allocations, santri_credits, income_transactions,
      expense_transactions, financial_ledger, approval_requests,
      approval_settings, budgets, transaction_attachments, audit_logs,
      notifications, settings, financial_periods, reversal_transactions)
- [x] UUID primary key, `NUMERIC/DECIMAL(18,2)` untuk semua kolom uang,
      timestamp timezone-aware (`TIMESTAMPTZ(6)`)
- [x] `school_id` di semua tabel domain (kecuali `schools` sendiri dan
      `roles` yang global) — tenant isolation
- [x] `financial_ledger`, `audit_logs`, `reversal_transactions` insert-only
      (tanpa `updated_at`/`deleted_at`)
- [x] Terminologi SIKEP dipakai konsisten: `santri`, `ClassLevel` enum
      K1-K6 + PENGABDIAN, role ADMIN/BENDAHARA/YAYASAN — tidak ada
      "siswa"/"Kepala Sekolah"/"Wakasek"
- [x] Jenis tagihan & master data keuangan tetap configurable (tabel biasa,
      bukan enum) — tidak ada financial logic hard-coded per nama tagihan
- [x] DB `CHECK` constraint: approver tidak boleh sama dengan requester di
      `approval_requests` (defense-in-depth atas aturan spec section 3/11)
- [x] `idempotency_key` UNIQUE di `income_transactions` dan
      `expense_transactions` (spec section 17)
- [x] Bug desain FK polimorfik pada `transaction_attachments` ditemukan
      sendiri & diperbaiki sebelum ada di migration final (lihat D17)
- [x] `npx prisma validate` dan `npx prisma generate` sukses
- [x] Migration SQL awal dibuat & di-commit-siap
      (`prisma/migrations/20260918000000_init/`) meski tanpa PostgreSQL
      nyata di environment ini (lihat D14)
- [x] Test schema-shape otomatis (`tests/unit/prisma/migration.test.ts`,
      23 test) memvalidasi DDL SQL asli — bukan hanya "terlihat benar"
- [x] `docs/architecture.md`, `docs/decisions.md`, `docs/development.md`
      diperbarui agar sesuai implementasi aktual

## Hasil Validasi

| Perintah                                            | Hasil                                    |
| --------------------------------------------------- | ---------------------------------------- |
| `npx prisma validate`                               | ✅ schema valid                          |
| `npx prisma generate`                               | ✅ Prisma Client ter-generate (26 model) |
| `npx prisma migrate diff --from-empty ... --script` | ✅ 786 baris SQL, tanpa perlu live DB    |
| `npm run lint`                                      | ✅ 0 error                               |
| `npm run typecheck`                                 | ✅ 0 error                               |
| `npm run test`                                      | ✅ 41/41 test lolos (5 file, +23 baru)   |
| `npm run build`                                     | ✅ build production sukses               |

## Temuan Selama Pengerjaan (self-review, sebelum diminta review eksternal)

1. **Bug ditemukan & diperbaiki**: rancangan awal `transaction_attachments`
   memberi kolom `entity_id` tunggal dua FK constraint sekaligus (ke
   `income_transactions` DAN `expense_transactions`) — relasional tidak
   mungkin terpenuhi. Diperbaiki dengan 3 kolom FK nullable terpisah,
   mengikuti pola yang sama seperti `financial_ledger`. Test regresi
   ditambahkan agar pola ini tidak lolos lagi tanpa terdeteksi.
2. Tidak ada PostgreSQL/Docker di environment ini — skema divalidasi lewat
   `prisma validate`/`generate` (butuh format benar, tapi tidak butuh
   koneksi DB) dan `prisma migrate diff --from-empty` (diff murni terhadap
   file schema). Test menguji SQL yang dihasilkan secara langsung.
   Concurrency/idempotency test terhadap database sungguhan tetap ditunda
   ke PHASE 5/6 sesuai rencana semula (D6).
3. `approval_requests` mendapat DB `CHECK` constraint tambahan yang
   ditambahkan manual ke migration SQL (di luar kemampuan DSL
   `schema.prisma` standar) — ada catatan operasional di D16 agar tidak
   hilang saat migration berikutnya dibuat dengan `prisma migrate dev`
   terhadap database nyata.

## Next Step

Ketik **`LANJUT PHASE 3`** untuk memulai `PHASE 3 — AUTH + RBAC` (Auth.js
atau setara, Argon2id, session cookie, middleware RBAC server-side
ADMIN/BENDAHARA/YAYASAN, seed 3 baris `roles`).
