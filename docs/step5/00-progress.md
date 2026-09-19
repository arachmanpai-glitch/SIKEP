# PHASE 5 — FINANCIAL ENGINE: Acceptance Checklist

Status: **SELESAI** (2026-09-18). Menunggu review/perintah `LANJUT PHASE 6`.

## Acceptance Criteria

- [x] `financial_ledger` adalah sumber kebenaran saldo — `getAccountBalance()`
      murni SUM, tidak ada kolom saldo mutable dibaca terpisah (D32)
- [x] `ENDING BALANCE = OPENING BALANCE + POSTED INCOME - POSTED EXPENSE + REVERSAL EFFECT`
      terimplementasi persis: opening balance jadi baris ledger sendiri,
      income/expense POSTED masing-masing jadi baris ledger bertanda
      +/-, reversal jadi baris ledger berlawanan tanda
- [x] Uang selalu `Prisma.Decimal` di service layer (`.minus()`, `.negated()`,
      `.gte()`, `.lt()`, `.isZero()`) — tidak pernah `Number`/`Float` untuk
      aritmetika, tidak ada di mana pun dalam kode PHASE 5
- [x] Income selalu langsung `POSTED` (tidak ada gate approval, sesuai
      spec section 11 yang hanya mendeskripsikan approval untuk expense)
- [x] Expense: threshold check (`amount >= expenseApprovalThreshold OR
category.requiresApproval`) menentukan `POSTED` langsung atau
      `PENDING_APPROVAL` — expense yang di-park TIDAK menyentuh ledger
- [x] Transaksi `POSTED` immutable — void mengubah status jadi `VOIDED`
      dan memulihkan saldo lewat baris `REVERSAL`, bukan edit/hapus
      langsung; `reversal_transactions` mencatat siapa/kenapa/link ke
      ledger entry
- [x] Cek saldo cukup (`allowNegativeBalance`) memakai isolasi transaksi
      `Serializable` + retry otomatis pada write-conflict (P2034) —
      mencegah race condition dua pengeluaran konkuren overdraw akun
      bersama (skenario wajib spec section 18)
- [x] `Idempotency-Key` (HTTP header) pada `POST /api/v1/income` dan
      `/api/v1/expenses` — replay mengembalikan record yang sama
      (`replayed: true`), bukan duplikat atau error
- [x] Setiap posting/submit/void tercatat di `audit_logs` lewat
      `AuditService` (POST/SUBMIT/VOID/REVERSAL — 4 dari 12 action spec
      section 16 sekarang benar-benar terpakai)
- [x] Hanya role BENDAHARA yang bisa mencatat/void transaksi (D38); GET
      terbuka untuk semua role yang login
- [x] Tenant isolation & CSRF diterapkan konsisten dengan PHASE 3/4
- [x] Tidak ada `tx.xxx`/`prisma.xxx` dipanggil langsung dari service —
      semua lewat repository, termasuk kode di dalam `prisma.$transaction`
      (D35, ditemukan & diperbaiki sendiri sebelum menulis test)
- [x] Logika reversal ledger TIDAK disalin-tempel antara Income dan
      Expense — satu `services/ReversalService.ts` dipakai keduanya (D36)

## Hasil Validasi

| Perintah            | Hasil                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`      | ✅ 0 error                                                                                                                                     |
| `npm run typecheck` | ✅ 0 error                                                                                                                                     |
| `npm run test`      | ✅ 169/169 test lolos (32 file, +44 baru)                                                                                                      |
| `npm run build`     | ✅ build production sukses, 21 route (4 baru: income/expenses + void)                                                                          |
| Preview browser     | ✅ `/api/v1/income` & `/api/v1/expenses` → JSON 401 yang benar saat belum login; route void hanya menerima POST (405 untuk GET, sesuai desain) |

## Temuan & Perbaikan Selama Pengerjaan (self-review)

1. **Bug arsitektur ditemukan & diperbaiki SEBELUM menulis test**: draft
   pertama `IncomeService`/`ExpenseService` memanggil `tx.financialAccount
.findFirst(...)`, `tx.approvalRequest.create(...)`, dll langsung di
   dalam `prisma.$transaction` — melanggar aturan arsitektur "service
   tidak pernah panggil Prisma langsung". Diperbaiki dengan memfaktorkan
   ke `repositories/FinancialLookupRepository.ts` dan
   `repositories/ApprovalRequestRepository.ts` sebelum lanjut ke test —
   hasilnya service jadi jauh lebih mudah di-unit-test (mock repository,
   bukan bikin fake Prisma transaction client).
2. **Duplikasi ditemukan & difaktorkan**: logika "post baris REVERSAL +
   catat reversal_transactions" awalnya ditulis identik di
   `IncomeService.voidIncome` dan `ExpenseService.voidExpense` —
   dipindah ke `services/ReversalService.ts` bersama sebelum kode
   dianggap selesai (D36).
3. Setiap keputusan desain non-trivial (isolasi Serializable, semantik
   Idempotency-Key, opening balance sebagai baris ledger) diverifikasi
   dengan node REPL langsung terhadap Prisma Client sebelum ditulis ke
   kode produksi (mis. `Prisma.Decimal.negated()`/`.isZero()`,
   `Prisma.TransactionIsolationLevel.Serializable`) — bukan ditebak dari
   ingatan.
4. **Keterbatasan yang diakui secara eksplisit**: race condition
   konkurensi Postgres sungguhan (dua request paralel ke server nyata)
   tidak bisa diuji di environment ini (tidak ada PostgreSQL live, sama
   seperti D14 PHASE 2). Yang diuji PHASE 5 adalah mekanisme retry
   (`lib/serializable-retry.ts`) secara terisolasi dan logika
   threshold/saldo di service layer (mocked) — bukan perilaku Postgres
   `Serializable` yang sesungguhnya di bawah beban konkuren. Ini utang
   test yang harus dilunasi begitu ada database nyata (PHASE 6 atau
   PHASE 11 TESTING), bukan diam-diam dianggap "sudah teruji".
5. Endpoint approve/reject untuk `approval_requests` SENGAJA tidak
   dibangun (D37) — expense yang butuh approval akan terlihat "macet" di
   `PENDING_APPROVAL` sampai PHASE 7. Ini status yang diharapkan, dicatat
   di sini supaya tidak disalahartikan sebagai fitur yang lupa dikerjakan.

## Next Step

Ketik **`LANJUT PHASE 6`** untuk memulai `PHASE 6 — BILLING + PAYMENT`
(`PaymentService`: tagihan santri individual/massal, pembayaran
penuh/sebagian/beberapa tagihan sekaligus, overpayment → `santri_credits`,
setiap pembayaran menghasilkan `income_transactions` + posting ledger
lewat `IncomeService` yang sudah ada).
