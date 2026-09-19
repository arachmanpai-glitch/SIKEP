# Arsitektur SIKEP

## Prinsip Utama

Urutan prioritas (tidak boleh dikorbankan demi kecepatan pengembangan):

1. Correctness
2. Financial Integrity
3. Security
4. Data Consistency
5. Auditability
6. Testability
7. Maintainability
8. UX
9. Performance
10. Speed of Development

## Lapisan (Layering)

```
Presentation (app/, components/)
        ↓
API / Server Action (app/api/v1/**, app/**/actions.ts)
        ↓
Authentication (lib/rbac.ts getSession() — JWT session, PHASE 3)
        ↓
Authorization (lib/rbac.ts requireRole()/requireSameSchool() — PHASE 3)
        ↓
Service Layer (services/*Service.ts)
        ↓
Domain Logic (di dalam service, murni & testable)
        ↓
Repository (repositories/*Repository.ts)
        ↓
Prisma (lib/prisma.ts)
        ↓
PostgreSQL
```

Aturan keras: **UI tidak pernah memanggil Prisma langsung**, dan **mutasi
keuangan wajib melalui service layer** (lihat `services/README.md`). Route
handler hanya melakukan: autentikasi → otorisasi → validasi Zod → panggil
service → format response dengan `lib/api-response.ts`.

## Struktur Proyek

```
sikep/
├── app/                 # Next.js App Router: routes, layouts
│   ├── api/v1/auth/      #   login/logout/me
│   ├── api/v1/master-data/[entity]/  #  6 entity generik (D25)
│   ├── api/v1/santri/    #   Data Santri (D26)
│   ├── api/v1/users/     #   Manajemen user (D27)
│   ├── api/v1/settings/approval/  #  Threshold approval (D28)
│   ├── api/v1/income/    #   PHASE 5: catat & void pemasukan
│   ├── api/v1/expenses/  #   PHASE 5: submit (post/pending-approval) & void pengeluaran
│   ├── api/v1/santri-bills/  #  PHASE 6: tagihan individual & massal (bulk/)
│   ├── api/v1/santri-payments/  #  PHASE 6: catat & void pembayaran
│   ├── api/v1/santri-credits/apply/  #  PHASE 6: pakai kredit untuk tagihan
│   ├── api/v1/approval-requests/  #  PHASE 7: list, [id]/approve, [id]/reject
│   ├── api/v1/dashboard/summary/  #  PHASE 8: ringkasan dashboard (D49)
│   ├── api/v1/reports/   #   PHASE 8: financial/, billing/, masing-masing + export/
│   ├── api/v1/financial-periods/  #  PHASE 9: list/create, [id]/close (D54/D56-D59)
│   ├── api/v1/audit-logs/  #   PHASE 9: list dengan filter (D58)
│   ├── api/v1/health/     #   PHASE 12: liveness/readiness check (D70/D71)
│   ├── admin/            #   Halaman Admin (master-data/[entity], santri, users, settings)
│   ├── dashboard/         #   PHASE 8: halaman Dashboard (Recharts)
│   ├── laporan/           #   PHASE 8: halaman Laporan (filter + export PDF/XLSX)
│   ├── rekonsiliasi/       #  PHASE 9: buat/tutup periode keuangan (Bendahara)
│   ├── audit/              #  PHASE 9: tabel audit log (Admin/Yayasan)
│   ├── login/            #   Halaman login (client component)
│   ├── error.tsx          #  PHASE 12: error boundary per-segmen (D72-D74)
│   ├── global-error.tsx   #  PHASE 12: error boundary root layout (D72-D74)
│   └── not-found.tsx      #  PHASE 12: halaman 404 custom
├── components/
│   └── admin/            #   MasterDataAdminClient (generic, reuse 6 entity)
├── lib/                 # Cross-cutting: env, logger, errors, prisma client,
│   ├── auth/             #   password, session (JWT), cookies, csrf, rate-limit, require-csrf
│   ├── validation/       #   skema Zod per domain
│   ├── master-data/      #   entities.ts (slug tunggal), registry.ts (server), ui-config.ts (client)
│   ├── reports/           #   PHASE 8: pdf.ts (pdfkit), xlsx.ts (exceljs) — Buffer, tanpa tulis disk
│   ├── client/api.ts     #   fetch wrapper client (CSRF header + envelope parsing)
│   ├── prisma-errors.ts  #   P2002/P2025 -> ConflictError/NotFoundError
│   ├── idempotency.ts    #   Idempotency-Key replay (D34)
│   ├── serializable-retry.ts  #  retry P2034 (D33)
│   ├── security-headers.ts  # PHASE 10: CSP + header keamanan statis (D61)
│   ├── health.ts          #  PHASE 12: checkHealth (D71)
│   └── rbac.ts           #   getSession/requireSession/requireRole/requireSameSchool
├── services/             # Domain/service layer — SATU-SATUNYA tempat mutasi keuangan
│   ├── masterDataService.ts  #  generic engine (D25)
│   ├── LedgerService.ts  #   getAccountBalance, ensureOpeningBalanceEntry (D32)
│   ├── IncomeService.ts  #   recordIncome, voidIncome
│   ├── ExpenseService.ts #   submitExpense (threshold+saldo), voidExpense
│   ├── ReversalService.ts #  reverseLedgerEntry, dipakai Income & Expense (D36)
│   ├── BillingService.ts #   PHASE 6: tagihan individual/massal
│   ├── PaymentService.ts #   PHASE 6: alokasi pembayaran + posting income (D39/D40)
│   ├── CreditService.ts  #   PHASE 6: pool kredit santri (D42/D43)
│   ├── ApprovalService.ts #  PHASE 7: approveExpense/rejectExpense (D45-D48)
│   ├── DashboardService.ts #  PHASE 8: getDashboardSummary (D49/D52/D53)
│   ├── ReportService.ts  #   PHASE 8: getFinancialReport, getBillingReport
│   ├── FinancialPeriodService.ts #  PHASE 9: assertPeriodOpenForDate (D57),
│   │                        #   createFinancialPeriod (D59), closeFinancialPeriod (D54/D56)
│   ├── AuditLogService.ts #  PHASE 9: listAuditLogsForSchool (read-only wrapper)
│   └── AuditService.ts   #   satu-satunya penulis audit_logs
├── repositories/          # Data-access layer, membungkus Prisma — SEMUA akses Prisma
│                           #   di dalam prisma.$transaction juga lewat sini (D35)
│                           #   (DashboardRepository.ts, ReportRepository.ts: PHASE 8, read-only;
│                           #   FinancialPeriodRepository.ts, AuditLogRepository.ts: PHASE 9)
├── types/                # Tipe TypeScript yang dibagi lintas layer
├── constants/             # Konstanta infrastruktur + role codes tetap (D12)
├── prisma/                # schema.prisma + migrations + seed.ts + seed-data/
├── proxy.ts               # Route gate Next.js 16 (dulu middleware.ts, D23)
├── tests/                 # Vitest: tests/unit, tests/integration (PHASE 11)
└── docs/                  # Dokumentasi arsitektur, keputusan & deployment.md (PHASE 12)
```

Domain master data (role, kelas K1-K6/Pengabdian, jenis tagihan, dll) TIDAK
di-hard-code sebagai konstanta aplikasi — disimpan sebagai data ter-seed di
database dan configurable, sesuai aturan #5 dan #13 dari spesifikasi SIKEP.

## Kontrak API

Semua endpoint di bawah `/api/v1/`. Response sukses:

```json
{ "success": true, "data": {}, "message": "Operasi berhasil." }
```

Response error:

```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Pesan error." } }
```

Diimplementasikan di [`lib/api-response.ts`](../lib/api-response.ts)
(`apiSuccess`, `apiError`, `handleApiError`). Mutasi keuangan wajib
mendukung header `Idempotency-Key` (diimplementasikan mulai PHASE 5) untuk
mencegah transaksi ganda.

## Prinsip Keuangan

- Sumber kebenaran saldo: `financial_ledger` — `getAccountBalance()` di
  `services/LedgerService.ts` adalah SUM murni, tidak ada kolom saldo yang
  bisa diedit manual di mana pun (D32).
- `ENDING BALANCE = OPENING BALANCE + POSTED INCOME - POSTED EXPENSE + REVERSAL EFFECT`
  — `OPENING BALANCE` sendiri adalah baris ledger (`entryType: OPENING_BALANCE`),
  bukan dibaca terpisah dari kolom lain.
- Hanya transaksi berstatus `POSTED` yang memengaruhi saldo — pengeluaran
  `PENDING_APPROVAL` sama sekali tidak menyentuh `financial_ledger` sampai
  disetujui (PHASE 7).
- Uang selalu `NUMERIC(18,2)`/`Prisma.Decimal` di database & service layer
  dan string desimal (`"500000.00"`) di JSON API — tidak pernah `Float`
  atau `Number` untuk aritmetika uang (lihat pemakaian `.minus()`/`.negated()`/
  `.gte()` di `services/ExpenseService.ts`, bukan operator `+`/`-` JS).
- Transaksi `POSTED` immutable: koreksi lewat `voidIncome`/`voidExpense`
  (`POSTED → VOIDED`) + `services/ReversalService.ts` (baris `REVERSAL`
  berlawanan tanda + baris `reversal_transactions`) — tidak pernah
  edit/hapus langsung.
- Approval pengeluaran: threshold default Rp1.000.000 (configurable) atau
  `category.requires_approval = true`; PHASE 5 menentukan APAKAH suatu
  pengeluaran butuh approval dan memparkirnya di `PENDING_APPROVAL` bila
  ya — approve/reject sungguhan adalah PHASE 7 (D37).
- Idempotency-Key (header HTTP) mencegah transaksi ganda akibat retry
  jaringan — lihat D34.
- Race condition saldo (dua pengeluaran konkuren) dicegah dengan isolasi
  transaksi `Serializable` + retry, bukan "baca-lalu-tulis" naif — lihat
  D33.

## Keamanan

### Auth + RBAC (PHASE 3)

- **Password**: Argon2id (`lib/auth/password.ts`, `@node-rs/argon2`), tidak
  pernah `argon2` biasa/`bcrypt` — parameter mengikuti rekomendasi minimum
  OWASP (D21). `AuthService.login` selalu menjalankan verify() (asli atau
  dummy) supaya jalur "email tidak ada" dan "password salah" butuh waktu
  yang sama (mencegah timing side-channel, D20).
- **Session**: JWT stateless HS256 (`lib/auth/session.ts`, library `jose`,
  D18/D22), bukan tabel `sessions` di database. Disimpan di cookie
  `sikep_session`: `HttpOnly`, `Secure` (production), `SameSite=Lax`, masa
  berlaku 8 jam (D19).
- **CSRF**: pola double-submit cookie (`lib/auth/csrf.ts`) — cookie
  `sikep_csrf` (readable, non-HttpOnly) harus dicocokkan dengan header
  `X-CSRF-Token` pada setiap request yang mengubah state. `/api/v1/auth/logout`
  adalah contoh acuan; **setiap endpoint mutating PHASE 5+ wajib
  memanggil `verifyCsrfToken`**.
- **Rate limiting**: `lib/auth/rate-limit.ts`, 5 percobaan login / 15 menit
  per kombinasi IP+email, in-memory (catatan scaling di D19).
- **RBAC**: `lib/rbac.ts` — `requireSession()`/`requireRole(...codes)`
  dipanggil di SETIAP route/server action, bukan hanya di `proxy.ts`.
  `proxy.ts` (dulu `middleware.ts`, di-rename Next.js 16 — D23) hanya
  gerbang UX kasar yang redirect ke `/login`; **bukan** batas otorisasi
  (D24) — lihat komentar di `proxy.ts` dan `lib/rbac.ts`.
- **IDOR**: `requireSameSchool(session, resource.schoolId)` di `lib/rbac.ts`
  — wajib dipanggil setiap route/service memuat resource by-id, sebelum
  data/mutasi diteruskan. `schoolId` request selalu berasal dari session
  (`authenticated_user.school_id`), tidak pernah dari body/query/param
  client.
- **Role**: hanya 3 kode tetap (`constants/roles.ts`, `ROLE_CODES`) —
  ADMIN/BENDAHARA/YAYASAN — divalidasi terhadap tabel `roles` (D12).

### XSS & SQL Injection

Proteksi didapat "gratis" dari React (auto-escaping) dan Prisma
(parameterized query) — diverifikasi PHASE 10 lewat `grep` menyeluruh:
tidak ada satu pun pemakaian `dangerouslySetInnerHTML` atau raw SQL tanpa
parameter binding di seluruh codebase (lihat `docs/decisions.md` D63).

### Security Headers (PHASE 10)

`lib/security-headers.ts` (fungsi murni, testable) mendefinisikan header
yang dipasang ke SETIAP response lewat `next.config.ts` `headers()`:

- `Content-Security-Policy` — `default-src 'self'`, `frame-ancestors 'none'`,
  `object-src 'none'`, dst. CSP statis (tanpa nonce) — lihat D61 untuk
  alasan trade-off ini dibanding CSP berbasis nonce.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` (camera/microphone/geolocation dimatikan).
- `Strict-Transport-Security` — hanya di production (tidak masuk akal di
  `next dev` localhost tanpa HTTPS).
- `poweredByHeader: false` — header `X-Powered-By: Next.js` dimatikan.

### Audit Keamanan PHASE 10 (verifikasi, bukan perbaikan bug)

Diperiksa sistematis lewat `grep` terhadap seluruh `app/api/v1/**/route.ts`
sebelum PHASE 10 menambah kode apa pun — hasilnya SEMUA sudah benar sejak
phase-phase sebelumnya (tidak ada bug yang diperbaiki, murni verifikasi):

- Setiap route `POST`/`PATCH`/`DELETE` memanggil `requireCsrf` KECUALI
  `POST /api/v1/auth/login` (benar — belum ada sesi/cookie CSRF untuk
  dicocokkan sebelum login berhasil).
- Setiap route memanggil `requireSession`/`requireRole` KECUALI login
  (benar — itu rute publik satu-satunya).
- Tidak ada `repositories/*.ts` yang melakukan `findFirst`/`update`/`delete`
  dengan `where: { id }` saja tanpa `schoolId` — setiap query by-id
  konsisten menyertakan `schoolId` (IDOR/tenant-isolation, D12/D24 sejak
  PHASE 3-4).

## Multi-Tenant

Semua tabel domain menyertakan `school_id`, kecuali `schools` sendiri
(tenant root) dan `roles` (referensi global, lihat di bawah). Query selalu
di-scope dari `authenticated_user.school_id` sisi server, tidak pernah dari
input client.

## Skema Database (PHASE 2)

26 tabel di [`prisma/schema.prisma`](../prisma/schema.prisma), persis
sesuai daftar minimum spesifikasi SIKEP section 13. Dikelompokkan:

- **Identity & tenancy**: `schools`, `roles` (referensi global, 3 baris
  tetap — lihat D12), `users`.
- **Struktur akademik**: `academic_years`, `classes` (kombinasi tahun ajaran
  × `ClassLevel` — K1-K6/PENGABDIAN adalah enum tetap, lihat D13).
- **Santri**: `santri`.
- **Master data keuangan (configurable, PHASE 4 yang mengisi)**:
  `financial_accounts`, `fund_sources`, `transaction_categories`,
  `bill_types`.
- **Billing & pembayaran**: `santri_bills`, `santri_payments`,
  `payment_allocations`, `santri_credits` (ledger kredit append-only,
  bukan satu kolom saldo — meniru filosofi `financial_ledger`).
- **Transaksi & ledger**: `income_transactions`, `expense_transactions`,
  `financial_ledger` (**insert-only**, tanpa `updated_at`/`deleted_at`).
- **Approval**: `approval_requests`, `approval_settings`.
- **Anggaran**: `budgets`.
- **Bukti transaksi**: `transaction_attachments` — `storage_key` privat
  (bukan URL publik), relasi ke income/expense/payment lewat tiga kolom FK
  nullable terpisah, bukan satu kolom polimorfik (lihat D17).
- **Audit & notifikasi**: `audit_logs` (**immutable**), `notifications`.
- **Settings & periode**: `settings` (key-value per sekolah),
  `financial_periods`, `reversal_transactions`.

Konvensi yang berlaku di semua tabel — detail & alasan lengkap ada di
komentar header [`prisma/schema.prisma`](../prisma/schema.prisma) dan
`docs/decisions.md` (D11-D17):

- Primary key `UUID`, uang `DECIMAL(18,2)`, timestamp `TIMESTAMPTZ(6)`.
- `financial_ledger`, `audit_logs`, `reversal_transactions` tidak pernah
  di-UPDATE/DELETE — koreksi selalu berupa baris baru.
- DB `CHECK` constraint (ditambah manual ke migration SQL) mencegah
  approver sama dengan requester di `approval_requests` — defense-in-depth
  di atas validasi service layer PHASE 7.

Migration awal: `prisma/migrations/20260918000000_init/migration.sql`,
dibuat tanpa live database (lihat D14) lewat
`prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`.
Diuji lewat `tests/unit/prisma/migration.test.ts` yang membaca SQL ini
langsung (bukan lewat DMMF runtime Prisma Client, yang di v7 sudah tidak
menyertakan metadata unique/native-type).

## Observability

`lib/logger.ts` menyediakan logger terstruktur (Pino) dengan redaksi field
sensitif (`password`, `token`, `secret`, header `Authorization`/`Cookie`).
Setiap service/repository/route handler membuat child logger sendiri:
`logger.child({ module: "PaymentService" })`.

## Master Data (PHASE 4)

**Generic CRUD engine** (`services/masterDataService.ts`) menangani 7
entity tenant-scoped, soft-deletable yang di-CRUD Admin dengan audit
otomatis (D25/D26): `academic-years`, `classes`, `financial-accounts`,
`fund-sources`, `transaction-categories`, `bill-types`, dan `santri`.
Setiap entity hanya mendaftarkan `MasterDataAdapter` (panggilan Prisma
yang genuinely berbeda per model) di
`repositories/masterDataAdapters.ts`/`SantriRepository.ts`; orkestrasi
validasi→tenant-scoping→audit dipakai bersama. Slug URL entity
didefinisikan sekali di `lib/master-data/entities.ts` (tanpa import
server-only) dan dipakai baik oleh registry server
(`lib/master-data/registry.ts`, `Record<Slug,...>` — TypeScript menolak
compile kalau ada slug hilang) maupun config form UI client
(`lib/master-data/ui-config.ts`).

**User** (`services/UserService.ts`) dan **Approval Settings**
(`services/SettingsService.ts`) TIDAK memakai engine generic — user punya
resolusi role+password hashing (D27), settings memakai audit action
`CONFIG_CHANGE` khusus (D28), keduanya business rule yang genuinely beda
dari CRUD generik.

**CSRF** pada semua endpoint mutating PHASE 4 mengikuti pola yang sama
seperti `/api/v1/auth/logout` (PHASE 3): `requireCsrf(request)` dipanggil
tepat setelah `requireRole()`/`requireSession()`. Client component
memakai helper bersama `lib/client/api.ts` (`apiGet`/`apiMutate`) yang
otomatis menyertakan header `X-CSRF-Token`.

**Proxy dan API**: `proxy.ts` mengecualikan SELURUH `/api/**` dari
redirect-ke-login (D30) — endpoint API selalu balas JSON dari
`requireSession()`/`requireRole()` miliknya sendiri, tidak pernah
redirect HTML, supaya `lib/client/api.ts` (yang mengharapkan
`response.json()`) tidak pernah menerima halaman HTML saat sesi habis.
`/admin/**` (halaman) tetap di-redirect ke `/login`, dan non-Admin
di-redirect keluar dari `/admin/**` di level proxy juga (UX saja — otorisasi
sungguhan tetap di `requireRole("ADMIN")` setiap route).

## Financial Engine (PHASE 5)

Alur posting (`services/IncomeService.ts` `recordIncome`,
`services/ExpenseService.ts` `submitExpense`) selalu:

```
validasi Zod (route)
  → requireRole("BENDAHARA") + requireCsrf (route)
    → resolve idempotency (lib/idempotency.ts — replay jika Idempotency-Key
      sudah pernah dipakai)
      → prisma.$transaction(...)   [Serializable khusus expense-posting, D33]
          → validasi tenant-scoping (repositories/FinancialLookupRepository.ts)
          → (khusus expense) cek saldo cukup (services/LedgerService.ts
            getAccountBalance) vs approval_settings.allowNegativeBalance
          → create baris income_transactions/expense_transactions
          → create baris financial_ledger (repositories/LedgerRepository.ts)
          → recordAudit (POST/SUBMIT)
```

**Income**: tidak ada gate approval (spec section 11 hanya berlaku untuk
expense) — selalu langsung `POSTED` dalam satu transaksi atomik.

**Expense**: `ExpenseService.submitExpense` menentukan
`amount >= approval_settings.expenseApprovalThreshold OR category.requiresApproval`
SEBELUM membuka transaksi utama (baca konfigurasi, bukan bagian yang perlu
konsisten dengan cek saldo). Kalau perlu approval → `PENDING_APPROVAL` +
baris `approval_requests` (`PENDING`), TIDAK menyentuh ledger. Kalau
tidak → transaksi `Serializable` yang mengecek saldo dan langsung
`POSTED` ke ledger. PHASE 7 (belum dibangun, D37) yang memindahkan
`PENDING_APPROVAL` menjadi `POSTED` atau kembali ke `DRAFT`.

**Void & Reversal** (`services/ReversalService.ts`, dipakai
`IncomeService.voidIncome`/`ExpenseService.voidExpense`): hanya transaksi
`POSTED` yang bisa di-void. Efeknya: status → `VOIDED`, baris
`financial_ledger` baru bertipe `REVERSAL` dengan tanda berlawanan dari
baris asli (memulihkan saldo), baris `reversal_transactions` yang
menautkan keduanya, dan DUA audit log (`VOID` lalu `REVERSAL` — spec
section 16 mendaftar keduanya terpisah).

**Konkurensi & Idempotency** — lihat D33/D34/D36 di `docs/decisions.md`
untuk alasan lengkap:

- `lib/serializable-retry.ts` — retry otomatis saat Postgres
  `Serializable` mendeteksi write-conflict (P2034).
- `lib/idempotency.ts` — replay `Idempotency-Key` mengembalikan hasil
  yang sama, bukan error atau duplikat.
- `services/ReversalService.ts` — satu implementasi reversal dipakai
  Income maupun Expense (bukan disalin-tempel).

Test konkurensi Postgres NYATA (dua request paralel sungguhan) belum bisa
dijalankan di environment ini (tidak ada PostgreSQL live, D14) — yang
diuji PHASE 5 adalah mekanisme retry & logika threshold/saldo di lapisan
service (mocked). Dicatat sebagai utang test eksplisit di
`docs/step5/00-progress.md`, bukan diam-diam dianggap selesai.

## Billing & Payment (PHASE 6)

**Tagihan** (`services/BillingService.ts`): individual
(`createBillForSantri`) atau massal (`createBulkBillsForSantri`, loop
atomik dalam satu `$transaction`, satu audit `CREATE` per tagihan).

**Pembayaran** (`services/PaymentService.ts` `recordPayment`) — satu
transaksi atomik yang:

```
validasi santri/akun/sumber-dana/kategori
  → (jika ada billIds) ambil & validasi semua tagihan milik santri ini
    → urutkan by dueDate ASC (D40), alokasikan sisa pembayaran tagihan-per-tagihan
      → IncomeService.postIncomeWithinTransaction (posting ke ledger, D39)
        → create santri_payments (referensi incomeTransactionId)
          → create payment_allocations + update amount_paid/status tiap tagihan
            → sisa (jika ada) → santri_credits ISSUED (overpayment / deposit di muka, D41)
```

`lib/bill-status.ts` (`computeBillStatus`) adalah SATU-SATUNYA tempat
keputusan UNPAID/PARTIAL/PAID dibuat — dipakai `PaymentService` maupun
`CreditService`, tidak diduplikasi.

**Kredit** (`services/CreditService.ts`): `santri_credits` adalah pool
fungibel per santri (`SUM` seluruh baris = saldo tersedia), bukan
dilacak per-lot ke pembayaran asalnya (D43). `applyCreditToBill`
memakai kredit yang sudah ada untuk melunasi tagihan TANPA membuat baris
`santri_payments` baru (D42) — tidak ada uang baru masuk, hanya realokasi
internal.

**Void pembayaran** (`PaymentService.voidPayment`): membalik alokasi
tagihan, membalik income terkait (reuse `voidIncomeWithinTransaction`,
D39), dan membalik kredit yang diterbitkan pembayaran itu — TAPI menolak
kalau saldo kredit santri sudah turun di bawah jumlah yang diterbitkan
pembayaran ini (D43, defensif karena kredit tidak dilacak per-lot).

Idempotency-Key pada `POST /api/v1/santri-payments` bekerja sama seperti
income biasa (D34) — key hidup di `income_transactions`, replay dipetakan
balik ke baris `santri_payments` yang mereferensikannya.

## Approval (PHASE 7)

Menyambung langsung ke `PENDING_APPROVAL` yang diparkir
`ExpenseService.submitForApproval` sejak PHASE 5. Hanya role `YAYASAN`
yang bisa memutuskan (spec section 2/3) — dan tidak boleh memutuskan
pengajuannya sendiri (creator ≠ approver, dijaga di aplikasi DAN
database, D47).

```
GET /api/v1/approval-requests?status=PENDING   (Yayasan meninjau)
  → POST .../{id}/approve
      → requireRole("YAYASAN") + guard creator≠approver (app-level)
        → ExpenseService.postApprovedExpenseWithinTransaction (D45):
            cek saldo (Serializable+retry, D33) → PENDING_APPROVAL → POSTED
              → posting ledger (EXPENSE, tanda negatif)
          → approval_requests: PENDING → APPROVED
        → audit APPROVE
  → POST .../{id}/reject  { reason }
      → PENDING_APPROVAL → REJECTED (tidak menyentuh ledger — belum pernah diposting)
      → approval_requests: PENDING → REJECTED (+ reason)
      → audit REJECT
```

`services/ApprovalService.ts` (`approveExpense`/`rejectExpense`) TIDAK
membuka `$transaction` sendiri untuk sisi expense — ia memanggil
`ExpenseService.postApprovedExpenseWithinTransaction` (mengambil `tx`
dari pemanggil, pola yang sama seperti `postIncomeWithinTransaction`
PHASE 6/D39) supaya posting expense + keputusan approval_requests
tetap satu unit atomik.

`REJECTED → DRAFT` (edit ulang + resubmit) yang tergambar di diagram
spec section 11 SENGAJA tidak dibangun (D46) — tidak ada kapabilitas
"edit transaksi pengeluaran" di mana pun dalam aplikasi ini untuk
diresubmit ke. Pengeluaran yang ditolak tetap `REJECTED`, riwayat penuh
(termasuk alasan) tersimpan di `approval_requests`.

## Dashboard & Laporan (PHASE 8)

Murni read-only — tidak ada mutasi keuangan baru di phase ini. Terbuka untuk
role manapun yang login (D52), sama seperti pola GET sejak PHASE 5.

```
GET /api/v1/dashboard/summary
  → DashboardService.getDashboardSummary:
      saldo per akun aktif (getAccountBalance yang SAMA dengan PHASE 5, D49)
      + pemasukan/pengeluaran bulan berjalan
      + jumlah approval PENDING
      + ringkasan status tagihan santri (UNPAID/PARTIAL/PAID + piutang)
      + tren 6 bulan terakhir (untuk grafik Recharts)
      + 10 transaksi terbaru (income+expense gabungan, terurut tanggal)

GET /api/v1/reports/financial?from=&to=        (JSON, grouped by kategori)
GET /api/v1/reports/financial/export?...&format=pdf|xlsx
GET /api/v1/reports/billing?academicYearId=&classId=&status=
GET /api/v1/reports/billing/export?...&format=pdf|xlsx
```

Kedua endpoint `.../export` adalah satu-satunya rute GET di codebase ini
yang punya efek samping tulis (`recordAudit({ action: "EXPORT" })`,
dibatasi hanya ke `audit_logs` — lihat D50). `lib/reports/pdf.ts` (pdfkit)
dan `lib/reports/xlsx.ts` (exceljs) masing-masing mengembalikan `Buffer`
langsung ke route handler, tidak pernah menulis file ke disk (D51).

UI: `/dashboard` (kartu ringkasan + `BarChart` pemasukan-vs-pengeluaran +
`PieChart` status tagihan, keduanya Recharts) dan `/laporan` (filter +
tabel + tombol Export PDF/XLSX yang memanggil endpoint export langsung
lewat `<a href>` — request GET biasa, tidak butuh CSRF).

## Rekonsiliasi & Audit (PHASE 9)

Tidak ada tabel baru (D54) — memakai `financial_periods` (ada sejak PHASE 2,
baru sekarang dipakai) dan kolom JSON `audit_logs.old_values`/`new_values`
untuk snapshot rekonsiliasi.

```
POST /api/v1/financial-periods  { name, startDate, endDate, academicYearId? }
  → requireRole("BENDAHARA") (D58)
  → tolak jika rentang tanggal bertabrakan dengan periode lain (D59)
  → audit CREATE

POST /api/v1/financial-periods/{id}/close  { balances: [{financialAccountId, actualBalance}] }
  → requireRole("BENDAHARA")
  → wajib mencakup SEMUA akun keuangan aktif (tidak boleh sebagian)
  → per akun: systemBalance = getAccountBalanceWithRetry (D55, sama dengan
    PHASE 5/8) ; difference = actualBalance - systemBalance
  → guard konkurensi WHERE status:"OPEN" (D48-style) → OPEN → CLOSED
  → audit CONFIG_CHANGE, newValues = { status: "CLOSED", reconciliation }
  → TIDAK ADA reopen (D56) — satu arah

GET /api/v1/audit-logs?action=&entityType=&userId=&from=&to=&page=&pageSize=
  → requireRole("ADMIN", "YAYASAN") (D58)
  → baca-saja dari audit_logs yang sudah ditulis services/AuditService.ts
    sejak PHASE 5 — PHASE 9 tidak mengubah cara audit_logs ditulis
```

`services/FinancialPeriodService.assertPeriodOpenForDate` dipanggil dari
`IncomeService.postIncomeWithinTransaction` dan `ExpenseService.submitAndPost`

- `submitForApproval` — menolak `transactionDate` yang jatuh di periode
  `CLOSED` dengan `FinancialIntegrityError`. Sengaja TIDAK dipanggil dari
  jalur void/reversal (D57) — koreksi transaksi lama tetap diizinkan kapan
  pun karena baris `REVERSAL` selalu bertanggal hari ini (periode berjalan).

UI: `/rekonsiliasi` (daftar periode + form buat periode + form tutup
periode yang menampilkan hasil rekonsiliasi per akun) dan `/audit` (tabel
audit log dengan filter aksi/entitas/tanggal + detail JSON
old/new values, berpaginasi).

Race condition "dua approver memutuskan approval request yang sama"
memakai mekanisme BERBEDA dari race condition saldo (D48): filter status
di klausa WHERE update (bukan isolasi `Serializable`) — cukup untuk
"siapa duluan menang", tidak perlu agregasi SUM yang konsisten seperti
cek saldo.

## Production (PHASE 12)

```
GET /api/v1/health
  → lib/health.ts checkHealth(): SELECT 1 ke database
      → { status: "ok", checks: { database: "ok" } }      200
      → { status: "error", checks: { database: "error" } } 503
  → publik, TANPA requireSession — dipanggil load balancer/process
    manager, bukan klien bisnis (envelope non-standar, D70/D71)
```

- `app/error.tsx` — error boundary per-segmen route (di bawah root
  layout). `app/global-error.tsx` — menangkap error di root layout itu
  sendiri (satu-satunya yang tidak dicakup `error.tsx`), wajib
  mendefinisikan `<html>`/`<body>` sendiri dan styling inline (tidak
  otomatis mewarisi `globals.css`). Keduanya `"use client"` dan memakai
  `console.error` (bukan `lib/logger.ts`/Pino — Node-only, tidak jalan di
  browser, D72), dan tidak pernah menampilkan `error.message` mentah ke
  pengguna (D73). Prop `retry` (bukan `reset`) — nama resmi Next.js
  16.3.5 yang terpasang, diverifikasi lewat dokumentasi lokal
  `node_modules/next/dist/docs/` (D74, lihat peringatan `AGENTS.md`).
- `app/not-found.tsx` — halaman 404 bergaya konsisten dengan rest of app
  (menggantikan halaman default Next.js).
- `docs/deployment.md` — panduan deploy production: environment variable
  wajib, urutan `npm ci` → migrate → `build` → `start`, health check
  untuk orchestrator, dan keterbatasan rate-limiting multi-instance
  (D19) yang sudah tercatat sejak PHASE 3.
