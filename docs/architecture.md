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
Authentication (Auth.js / equivalent — PHASE 3)
        ↓
Authorization (RBAC: ADMIN / BENDAHARA / YAYASAN — PHASE 3)
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
├── app/                 # Next.js App Router: routes, layouts, API handlers
├── components/          # Komponen UI (shadcn/ui di components/ui/**)
├── lib/                 # Cross-cutting: env, logger, errors, prisma client,
│                         #   api-response helpers, utils
├── services/             # Domain/service layer — SATU-SATUNYA tempat mutasi keuangan
├── repositories/          # Data-access layer, membungkus Prisma
├── types/                # Tipe TypeScript yang dibagi lintas layer
├── constants/             # Konstanta infrastruktur (bukan master data domain)
├── prisma/                # schema.prisma + migrations
├── tests/                 # Vitest: tests/unit, tests/integration (nanti)
└── docs/                  # Dokumentasi arsitektur & keputusan
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

## Prinsip Keuangan (ringkas — detail lengkap di spesifikasi SIKEP)

- Sumber kebenaran saldo: `financial_ledger` (dibangun PHASE 5), bukan
  kolom saldo yang bisa diedit manual.
- `ENDING BALANCE = OPENING BALANCE + POSTED INCOME - POSTED EXPENSE + REVERSAL EFFECT`.
- Hanya transaksi berstatus `POSTED` yang memengaruhi saldo.
- Uang selalu `NUMERIC(18,2)` di database dan string desimal (`"500000.00"`)
  di JSON API — tidak pernah `Float`.
- Transaksi `POSTED` immutable: koreksi dilakukan lewat alur
  `POSTED → VOIDED → REVERSAL`, bukan edit/hapus langsung.
- Approval pengeluaran: threshold default Rp1.000.000 (configurable) atau
  `category.requires_approval = true`; creator tidak boleh menjadi approver.

## Keamanan (ringkas)

Auth berbasis session (HttpOnly, Secure, SameSite cookie), Argon2id untuk
password hashing, RBAC di server (bukan hanya UI), isolasi tenant via
`school_id` dari `authenticated_user.school_id` (tidak pernah dipercaya dari
client), proteksi IDOR/CSRF/XSS/SQL-injection, rate limiting, signed URL
untuk object storage privat, dan audit log immutable untuk aksi kritikal.
Detail penuh diimplementasikan bertahap mulai PHASE 3 dan dikeraskan di
PHASE 10 (SECURITY HARDENING).

## Multi-Tenant

Semua tabel domain menyertakan `school_id`. Query selalu di-scope dari
`authenticated_user.school_id` sisi server, tidak pernah dari input client.

## Observability

`lib/logger.ts` menyediakan logger terstruktur (Pino) dengan redaksi field
sensitif (`password`, `token`, `secret`, header `Authorization`/`Cookie`).
Setiap service/repository/route handler membuat child logger sendiri:
`logger.child({ module: "PaymentService" })`.
