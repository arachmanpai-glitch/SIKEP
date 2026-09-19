# PHASE 9 — RECONCILIATION + AUDIT: Acceptance Checklist

Status: **SELESAI** (2026-09-19). Menunggu review/perintah `LANJUT PHASE 10`.

## Acceptance Criteria

- [x] `POST /api/v1/financial-periods` — buat periode keuangan baru
      (`BENDAHARA` only), menolak rentang tanggal yang bertabrakan dengan
      periode lain (D59)
- [x] `GET /api/v1/financial-periods` — daftar periode, terbuka untuk role
      manapun yang login
- [x] `POST /api/v1/financial-periods/{id}/close` — menutup periode,
      wajib saldo aktual untuk SEMUA akun keuangan aktif, menghasilkan
      snapshot rekonsiliasi (saldo sistem vs aktual + selisih) yang
      disimpan di audit log `CONFIG_CHANGE` (D54)
- [x] Penutupan periode tidak bisa dibalik — tidak ada endpoint reopen
      (D56, keputusan sadar, bukan celah)
- [x] Guard konkurensi: dua permintaan tutup periode yang sama secara
      bersamaan → yang kalah mendapat `ConflictError` (pola WHERE-clause
      yang sama dengan D48)
- [x] Pemasukan/pengeluaran BARU dengan `transactionDate` di periode yang
      sudah `CLOSED` ditolak dengan `FinancialIntegrityError` (D57) — guard
      dipasang di titik masuk inti (`postIncomeWithinTransaction`,
      `submitAndPost`, `submitForApproval`) sehingga otomatis melindungi
      pencatatan pemasukan langsung, `PaymentService` (santri payment),
      DAN kedua jalur pengeluaran (langsung/approval) tanpa duplikasi
- [x] Void/reversal transaksi lama TETAP diizinkan meski tanggal transaksi
      aslinya ada di periode yang sudah ditutup (D57 — praktik akuntansi
      standar, koreksi selalu bertanggal hari ini)
- [x] `GET /api/v1/audit-logs` — filter `action`/`entityType`/`userId`/
      `from`/`to` + paginasi, hanya `ADMIN`/`YAYASAN` (D58)
- [x] `audit_logs` tetap satu-satunya ditulis oleh
      `services/AuditService.ts` sejak PHASE 5 — PHASE 9 murni menambah
      jendela BACA, tidak mengubah cara tulisnya
- [x] Tidak ada tabel database baru — memakai `financial_periods` (sudah
      ada sejak PHASE 2, baru sekarang dipakai) dan kolom JSON
      `audit_logs.old_values`/`new_values` yang sudah ada (D54)
- [x] UI `/rekonsiliasi` (Bendahara: buat/tutup periode + lihat hasil
      rekonsiliasi) dan `/audit` (Admin/Yayasan: tabel + filter + detail
      JSON old/new values + paginasi)
- [x] Tenant isolation konsisten di semua query baru

## Hasil Validasi

| Perintah            | Hasil                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run lint`      | ✅ 0 error                                                                                                       |
| `npm run typecheck` | ✅ 0 error                                                                                                       |
| `npm run test`      | ✅ 253/253 test lolos (48 file, +14 baru)                                                                        |
| `npm run build`     | ✅ build production sukses, 39 route (5 baru: financial-periods(+[id]/close), audit-logs, /rekonsiliasi, /audit) |
| Preview browser     | ✅ Semua endpoint/halaman baru menolak akses unauthenticated (401 JSON / redirect `/login?next=...`)             |

## Temuan & Keputusan Selama Pengerjaan (self-review)

1. **Tidak ada spesifikasi granular untuk PHASE 9** selain nama phase dan
   modul "Rekonsiliasi" (di bawah Keuangan) + tanggung jawab "audit"
   (Admin) / "audit view" (Yayasan) di section 2 — scope konkret
   ditentukan sendiri (D54-D60), sama seperti pola PHASE 8.
2. **Keputusan skema penting (D54)**: SENGAJA tidak menambah tabel baru
   untuk rekonsiliasi — skema 26-tabel sudah dikunci sejak PHASE 2 (spec
   section 13). `financial_periods` (ada tapi belum pernah dipakai layanan
   apa pun sejak dibuat) dan kolom JSON `audit_logs` yang sudah ada
   ternyata cukup untuk seluruh kebutuhan fungsional PHASE 9 tanpa migrasi
   baru.
3. **Keputusan finansial paling penting (D57)**: awalnya sempat
   dipertimbangkan untuk mengunci periode berdasarkan `financial_ledger.postedAt`
   (yang selalu `now()`) — tapi disadari itu TIDAK melindungi apa pun
   secara praktis (periode yang ditutup selalu periode LAMPAU, jadi
   `now()` nyaris tidak pernah jatuh di dalamnya). Diperbaiki: guard
   memeriksa `transactionDate` (tanggal bisnis yang diinput user) di titik
   pembuatan transaksi, bukan `postedAt` — inilah proteksi yang sungguh
   bermakna terhadap pencatatan mundur ke buku yang sudah ditutup.
4. **Refactor kecil dalam-scope (D55)**: `getAccountBalanceWithRetry`
   diekstrak dari `DashboardService` (yang sebelumnya membungkus
   `Serializable` retry sendiri, PHASE 8) ke `services/LedgerService.ts`
   sebagai satu implementasi bersama, dipakai ulang oleh
   `FinancialPeriodService` — mencegah dua salinan boilerplate transaksi
   yang identik.
5. **Guard diletakkan di fungsi inti, bukan di setiap caller**: `assertPeriodOpenForDate`
   dipasang di `IncomeService.postIncomeWithinTransaction` (bukan hanya
   `recordIncome`) supaya `PaymentService.recordPayment` (yang memanggil
   primitive yang sama untuk posting income dari pembayaran santri) juga
   otomatis terlindungi tanpa mengulang guard yang sama.
6. **Keputusan scope yang disadari (D56)**: tidak ada "reopen periode" —
   konsisten dengan filosofi transaction-immutability yang sudah berlaku
   di level transaksi individual sejak PHASE 5, diperluas ke level
   periode.

## Next Step

Ketik **`LANJUT PHASE 10`** untuk memulai `PHASE 10 — SECURITY HARDENING`.
