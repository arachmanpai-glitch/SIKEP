# PHASE 11 — TESTING: Acceptance Checklist

Status: **SELESAI** (2026-09-19). Menunggu review/perintah `LANJUT PHASE 12`.

## Acceptance Criteria

Dicek terhadap spec section 18 ("Financial system tidak boleh dianggap
selesai hanya karena UI terlihat bekerja"):

- [x] Unit Test — sudah sangat ekstensif sejak PHASE 1-10 (260 test
      sebelum phase ini), tidak berubah
- [x] Integration Test — **BARU**: `tests/integration/*.test.ts`,
      memanggil service function ASLI dengan repository di-mock secara
      stateful (D66)
- [x] Concurrency Test — **BARU**: `tests/integration/concurrency.test.ts`
      (race approval, race penutupan periode — exactly-one-winner)
- [x] Idempotency Test — **BARU**: `tests/integration/idempotency.test.ts`
      (retry sekuensial + retry balapan dengan Idempotency-Key sama)
- [x] Financial Integrity Test — **BARU**: `tests/integration/
financial-integrity.test.ts`, skenario PERSIS spec section 18
      (saldo Rp1.000.000, dua expense Rp700.000, tidak boleh saldo negatif)
- [x] Security Test — **BARU**: `tests/integration/security.test.ts`,
      route handler ASLI (`GET`/`POST` dari `app/api/v1/**/route.ts`)
      dipanggil dengan `NextRequest` sungguhan (D67) — lapisan yang belum
      pernah diuji otomatis sebelumnya
- [x] E2E Test — diisi 2026-09-20 lewat instruksi eksplisit terpisah
      (di luar 12 phase resmi), lihat pembaruan di bawah + D81-D85
- [x] Skenario "concurrent transaction" spec section 18 dites persis
      seperti yang diminta (Rp1.000.000, dua Rp700.000)

## Catatan Scope: E2E Test (asli, PHASE 11)

E2E test (login sungguhan di browser → isi form → submit → verifikasi
hasil tersimpan) butuh: (1) PostgreSQL nyata dengan data ter-seed, dan
(2) test runner E2E (Playwright/Cypress). **Tidak ada satu pun yang
tersedia di lingkungan pengembangan ini** — sama seperti batasan yang
sudah dicatat sejak PHASE 2 (migration dibuat tanpa Postgres nyata) dan
PHASE 8-10 (verifikasi browser hanya bisa memastikan endpoint menolak
akses _unauthenticated_ dengan benar, tidak pernah benar-benar login).

Yang PHASE 11 lakukan sebagai gantinya — dan yang secara jujur BISA
dilakukan tanpa infrastruktur tersebut — adalah menaikkan level test
tertinggi yang tercapai dari "service layer" ke "route handler layer"
(`tests/integration/security.test.ts`, D67), sedekat mungkin dengan
perilaku HTTP sungguhan tanpa benar-benar butuh server berjalan. E2E
sesungguhnya dicatat sebagai kandidat PHASE 12 (PRODUCTION) atau kapan
pun akses ke PostgreSQL/staging environment tersedia.

## Update 2026-09-20: Gap Diisi (Instruksi Eksplisit Terpisah, Bukan PHASE 13)

PostgreSQL lokal sudah tersedia (dipasang & di-seed lewat sesi
sebelumnya, lihat memory proyek) sehingga gap di atas bisa diisi. Diisi
atas instruksi eksplisit terpisah — 12 phase resmi tetap selesai dan
utuh, bukan phase tersembunyi baru. Ringkasan (detail lengkap:
`docs/decisions.md` D81-D85):

- **Test runner**: Playwright (`@playwright/test`), config di
  `playwright.config.ts` (root) + `tests/e2e/`.
- **Database**: `sikep_e2e`, TERPISAH dari `sikep` dev — connection
  string diturunkan otomatis dari `DATABASE_URL` yang sudah ada di
  `.env` (`tests/e2e/db.ts`), tanpa perlu setup manual/kredensial baru
  (D82). Dibuat otomatis kalau belum ada, di-migrate, lalu di-reset +
  di-seed ulang deterministik SETIAP run (`tests/e2e/global-setup.ts` +
  `tests/e2e/seed.ts`, D81/D83) — tidak pernah menyentuh data dev `sikep`
  yang sudah berisi hasil kerja manual.
- **4 skenario golden-path**, satu per file di `tests/e2e/specs/`:
  `auth.spec.ts` (login benar/salah/logout, real session cookie),
  `income.spec.ts` (catat pemasukan → langsung POSTED),
  `expense-approval.spec.ts` (Bendahara ajukan di atas ambang batas →
  Yayasan approve di sesi browser TERPISAH → POSTED — satu-satunya
  lapisan test yang membuktikan handoff lintas-role sungguhan, bukan
  lewat mock), `attachment.spec.ts` (upload file SUNGGUHAN lewat
  `setInputFiles`, sesuatu yang alat browser-automation non-Playwright
  di sesi sebelumnya tidak bisa lakukan — lalu unduh ulang & verifikasi
  byte-for-byte identik).
- **2 bug ditemukan lewat kegagalan nyata saat menjalankan suite, bukan
  diasumsikan**: rate limiting login (D19) sungguhan memblokir login
  ke-6 dengan email yang sama dalam satu run (diperbaiki dengan
  identitas BENDAHARA terpisah per spec, D84); dan pengajuan pengeluaran
  ditolak `FinancialIntegrityError` "Saldo akun tidak mencukupi" karena
  fixture rekening bersaldo nol (diperbaiki dengan `openingBalance`
  nyata, D85, BUKAN dengan melemahkan pemeriksaan saldo — aplikasi sudah
  benar, fixture-nya yang kurang realistis).
- **Temuan UX di luar scope task ini, dicatat bukan diperbaiki**: tombol
  "Keluar" (logout) hanya ada di halaman `/` — tidak ada header/nav
  bersama di `app/layout.tsx` yang merender itu di halaman lain
  (`/dashboard`, `/pemasukan`, dst.), jadi pengguna harus kembali ke `/`
  dulu untuk logout dari halaman manapun.
- Diverifikasi: `npx playwright test` dijalankan BERULANG (bukan sekali)
  — 6/6 lolos secara konsisten, membuktikan seed/reset deterministik,
  bukan kebetulan lolos sekali. `npm run lint`/`typecheck`/`test`
  (303/303, tidak berubah)/`build` tetap 0 error/warning.

## Hasil Validasi

| Perintah                | Hasil                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run lint`          | ✅ 0 error                                                                                     |
| `npm run typecheck`     | ✅ 0 error                                                                                     |
| `npm run test`          | ✅ 275/275 test lolos (53 file, +15 baru: 4 file integration test)                             |
| `npm run test:coverage` | ✅ `services/`+`lib/`: 85.95% statements, 82.07% branch, 87.28% lines (lihat rincian di bawah) |
| `npm run build`         | ✅ build production sukses, 39 route (TIDAK ada route baru — phase ini murni testing)          |

### Rincian Coverage (`services/` + `lib/` + `repositories/`)

`repositories/*.ts` menunjukkan coverage rendah (11-17%) — ini SESUAI
DUGAAN, bukan kejutan: repository adalah lapisan tipis pembungkus Prisma
(`prisma.xxx.findFirst(...)`) yang HANYA benar-benar tereksekusi lewat
integration test terhadap database nyata (tidak ada di lingkungan ini,
D66) — di unit/integration test, repository SELALU di-mock (itu
sengaja, supaya test service tidak bergantung pada Prisma/DB). Angka
coverage yang relevan untuk menilai kualitas test adalah `services/`
(89.52% statements) dan `lib/` (95.74% statements), tempat logika bisnis
sesungguhnya hidup.

## Temuan & Keputusan Selama Pengerjaan (self-review)

1. **Keputusan terpenting (D66)**: tanpa PostgreSQL nyata, "Concurrency
   Test"/"Idempotency Test" tidak bisa membuktikan isolasi transaksi
   Postgres itu sendiri bekerja (itu fitur eksternal, sudah terverifikasi
   luas) — yang BISA dan HARUS dibuktikan adalah bahwa LOGIKA kode kami
   di atasnya benar (balance selalu dibaca ulang, WHERE-clause guard
   memilih tepat satu pemenang, retry P2034 transparan). Test integrasi
   ditulis dengan kejujuran itu sebagai batasan eksplisit, bukan
   berpura-pura menguji sesuatu yang sebenarnya tidak diuji.
2. **Financial integrity test awalnya salah desain**: percobaan pertama
   mensimulasikan "concurrent" murni lewat `Promise.all` dengan mock
   sinkron-cepat — ternyata KEDUA panggilan membaca saldo SEBELUM salah
   satu menulis (microtask interleaving lockstep JS, bukan concurrency
   DB sungguhan), sehingga tes salah-positif meloloskan overdraft.
   Diperbaiki: test sekuensial (await penuh panggilan pertama sebelum
   memanggil kedua) dikombinasikan dengan simulasi P2034-sekali-lalu-retry
   secara eksplisit, alih-alih mengandalkan urutan Promise yang
   kebetulan — lebih jujur dan lebih bisa diandalkan.
3. **`security.test.ts` adalah lapisan test yang benar-benar baru**:
   PHASE 1-10 tidak pernah punya automated test yang benar-benar
   memanggil sebuah route handler — verifikasi route selalu manual lewat
   `curl`/browser di akhir tiap phase. PHASE 11 mengisi celah ini dengan
   memanggil `GET`/`POST` asli langsung, membuktikan
   requireSession/requireRole/requireCsrf/handleApiError benar-benar
   terhubung dengan benar, bukan cuma masing-masing potongan bekerja
   sendiri-sendiri.
4. **`npm install @vitest/coverage-v8` tanpa pin versi memicu bug npm
   arborist** (`Cannot read properties of null (reading 'children')`) —
   root cause: versi tak-cocok (`5.0.1` vs `vitest@4.1.11` yang
   terpasang). Diperbaiki dengan memin versi persis sama (D68), pola yang
   sama dengan D2 di PHASE 1.

## Next Step

Ketik **`LANJUT PHASE 12`** untuk memulai `PHASE 12 — PRODUCTION` (phase
terakhir dari 12 phase resmi).
