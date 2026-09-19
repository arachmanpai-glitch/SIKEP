# PHASE 7 — APPROVAL: Acceptance Checklist

Status: **SELESAI** (2026-09-18). Menunggu review/perintah `LANJUT PHASE 8`.

## Acceptance Criteria

- [x] `POST /api/v1/approval-requests/{id}/approve` — memindahkan expense
      dari `PENDING_APPROVAL` ke `POSTED`, memposting ke `financial_ledger`
- [x] `POST /api/v1/approval-requests/{id}/reject` — memindahkan expense
      ke `REJECTED`, `reason` wajib diisi (spec section 11)
- [x] Cek saldo (`allowNegativeBalance`) dijalankan saat APPROVE (bukan
      saat submit), dengan isolasi `Serializable` + retry yang sama
      seperti posting expense langsung di PHASE 5 (D45)
- [x] Creator tidak boleh menjadi approver — dicek di aplikasi (pesan
      jelas) untuk APPROVE maupun REJECT, di atas CHECK constraint DB
      yang sudah ada sejak PHASE 2 (D16/D47)
- [x] Hanya role YAYASAN yang bisa approve/reject (spec section 2/3);
      GET daftar approval request terbuka untuk role manapun yang login
- [x] Guard konkurensi: dua approver memutuskan approval request yang
      sama secara bersamaan → yang kalah mendapat `ConflictError` yang
      jelas, bukan overwrite diam-diam (D48)
- [x] Setiap approve/reject tercatat di `audit_logs` dengan action
      `APPROVE`/`REJECT` (2 dari 12 audit action spec section 16 yang
      baru sekarang benar-benar terpakai)
- [x] Reject TIDAK menyentuh `financial_ledger` (expense yang di-reject
      memang belum pernah diposting)
- [x] Tenant isolation & CSRF konsisten dengan phase sebelumnya
- [x] Scope batas jelas: `REJECTED → DRAFT` (edit+resubmit) sengaja
      tidak dibangun, didokumentasikan sebagai keputusan (D46), bukan
      celah yang terlewat

## Hasil Validasi

| Perintah            | Hasil                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `npm run lint`      | ✅ 0 error                                                                                  |
| `npm run typecheck` | ✅ 0 error                                                                                  |
| `npm run test`      | ✅ 218/218 test lolos (41 file, +11 baru)                                                   |
| `npm run build`     | ✅ build production sukses, 30 route (3 baru: approval-requests, [id]/approve, [id]/reject) |
| Preview browser     | ✅ `/api/v1/approval-requests` → JSON 401 yang benar saat belum login                       |

## Temuan & Keputusan Selama Pengerjaan (self-review)

1. **Keputusan finansial penting yang diambil sendiri (D45)**: cek saldo
   untuk expense yang butuh approval sengaja BARU dijalankan saat
   approve, bukan saat submit — karena expense yang di-park mungkin
   tidak pernah diposting (bisa ditolak), dan saldo bisa berubah antara
   submit dan approve. Ini konsisten dengan desain `ExpenseService`
   PHASE 5 yang memang tidak mengecek saldo di jalur `submitForApproval`.
2. **Keputusan scope yang disadari (D46)**: `REJECTED → DRAFT` di diagram
   spec tidak dibangun karena tidak ada kapabilitas edit transaksi di
   mana pun dalam aplikasi ini — membangunnya tanpa itu hanya
   memindahkan dead-end, bukan menyelesaikannya. Dicatat eksplisit
   supaya tidak disalahartikan sebagai bug.
3. **Dua mekanisme concurrency-control dipakai secara sengaja berbeda**
   (D48): isolasi `Serializable` penuh untuk race condition saldo
   (agregasi SUM, D33), tapi hanya WHERE-clause status guard untuk race
   condition "siapa yang approve duluan" (murni first-writer-wins,
   tidak perlu agregasi) — dipilih sesuai kebutuhan masing-masing,
   bukan dipukul rata memakai yang paling mahal di semua tempat.
4. Reuse `postApprovedExpenseWithinTransaction` (dari `ExpenseService.ts`,
   menerima `tx` dari `ApprovalService`) mengikuti pola yang sama persis
   seperti `postIncomeWithinTransaction`/`voidIncomeWithinTransaction`
   dari PHASE 5/6 — konsistensi arsitektur yang sudah terbukti berulang
   kali di phase-phase sebelumnya.

## Next Step

Ketik **`LANJUT PHASE 8`** untuk memulai `PHASE 8 — DASHBOARD + REPORT`
(ringkasan saldo per akun, grafik pemasukan/pengeluaran, laporan PDF/XLSX,
UI yang lebih matang dari admin CRUD sederhana PHASE 4).
