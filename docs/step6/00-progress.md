# PHASE 6 — BILLING + PAYMENT: Acceptance Checklist

Status: **SELESAI** (2026-09-18). Menunggu review/perintah `LANJUT PHASE 7`.

## Acceptance Criteria

- [x] Tagihan individual (`createBillForSantri`) dan massal
      (`createBulkBillsForSantri`, atomik untuk banyak santri sekaligus)
- [x] Pembayaran penuh — bill 500rb, bayar 500rb → status `PAID`,
      `amountPaid` = 500rb, tidak ada kredit
- [x] Pembayaran sebagian — bill 500rb, bayar 300rb → status `PARTIAL`
- [x] Pembayaran beberapa tagihan sekaligus — satu pembayaran teralokasi
      ke lebih dari satu tagihan, urutan `dueDate` paling awal lebih
      dulu (D40)
- [x] Overpayment — bill 500rb, bayar 600rb → teralokasi 500rb ke
      tagihan, sisa 100rb otomatis jadi `santri_credits` (ISSUED)
- [x] Deposit di muka — pembayaran tanpa `billIds` → seluruh jumlah jadi
      kredit (D41)
- [x] Kredit bisa dipakai untuk tagihan lain (`CreditService.applyCreditToBill`)
      tanpa membuat baris `santri_payments` baru (D42 — bukan pemasukan
      uang baru)
- [x] Setiap pembayaran memposting `income_transactions` +
      `financial_ledger` secara atomik bersama alokasi tagihan (D39,
      reuse `IncomeService.postIncomeWithinTransaction` dari PHASE 5)
- [x] Histori pembayaran: `GET /api/v1/santri-payments?santriId=`,
      `GET /api/v1/santri-bills?santriId=`, `GET /api/v1/santri/{id}/credit-balance`
- [x] Void pembayaran membalik alokasi tagihan, income terkait, dan
      kredit yang diterbitkan — MENOLAK jika kredit itu sudah mungkin
      terpakai (D43, pool kredit fungibel bukan per-lot)
- [x] `Idempotency-Key` bekerja untuk `POST /api/v1/santri-payments` sama
      seperti income/expense
- [x] Tenant isolation, CSRF, role BENDAHARA-only untuk mutasi — konsisten
      dengan PHASE 3-5
- [x] Tidak ada `tx.xxx` dipanggil langsung dari service — semua lewat
      repository (D44, pola yang sama seperti D35 diulang tanpa
      perlu ditemukan ulang dari nol)
- [x] `lib/bill-status.ts` (`computeBillStatus`) satu-satunya sumber
      keputusan UNPAID/PARTIAL/PAID, dipakai PaymentService & CreditService

## Hasil Validasi

| Perintah            | Hasil                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`      | ✅ 0 error                                                                                                                                                                   |
| `npm run typecheck` | ✅ 0 error                                                                                                                                                                   |
| `npm run test`      | ✅ 207/207 test lolos (39 file, +38 baru)                                                                                                                                    |
| `npm run build`     | ✅ build production sukses, 27 route (6 baru: santri-bills, santri-bills/bulk, santri-payments, santri-payments/[id]/void, santri-credits/apply, santri/[id]/credit-balance) |
| Preview browser     | ✅ `/api/v1/santri-bills` & `/api/v1/santri-payments` → JSON 401 yang benar saat belum login                                                                                 |

## Temuan & Perbaikan Selama Pengerjaan (self-review)

1. **Refactor proaktif sebelum menulis kode baru**: `IncomeService.ts`
   difaktorkan agar mengekspos `postIncomeWithinTransaction`/
   `voidIncomeWithinTransaction` (menerima `tx` dari pemanggil) — supaya
   `PaymentService` bisa menggabungkan posting income dengan alokasi
   tagihan dalam SATU transaksi atomik, bukan dua transaksi terpisah
   yang berisiko tidak konsisten kalau salah satu gagal. Public API
   (`recordIncome`/`voidIncome`) tidak berubah — dikonfirmasi lewat
   test Phase 5 yang tetap lolos tanpa diubah.
2. **Bug arsitektur ditemukan & diperbaiki SEBELUM menulis test** (pola
   yang sama seperti D35 PHASE 5, kali ini terjadi lagi di draft pertama
   `PaymentService.voidPayment`): panggilan `tx.xxx` Prisma langsung
   difaktorkan ke repository (`listAllocationsForPaymentTx`,
   `findBillByIdTx`, `sumIssuedCreditForPayment`, `findIncomeByIdTx`) —
   bukti bahwa mendokumentasikan aturan secara eksplisit di PHASE 5 tidak
   otomatis mencegah kesalahan yang sama terulang saat menulis kode baru
   dengan cepat; perlu tetap di-review manual setiap kali.
3. **Keputusan desain non-trivial yang diambil sendiri** (tidak
   didetailkan eksplisit oleh spec, didokumentasikan di D40-D43):
   urutan alokasi pembayaran (FIFO by due date), `billIds` boleh kosong
   untuk deposit di muka, kredit sebagai pool fungibel (bukan lot-tracked)
   dengan konsekuensi `voidPayment` menolak secara konservatif kalau
   kredit sudah mungkin terpakai.
4. Test payment-allocation (multi-tagihan, overpayment, deposit di muka,
   void dengan kredit sudah/belum terpakai) ditulis mengikuti PERSIS
   contoh angka dari spec section 12 (tagihan 500rb, bayar 300rb/600rb)
   supaya verifikasi benar-benar terhadap requirement, bukan asumsi
   sendiri.

## Next Step

Ketik **`LANJUT PHASE 7`** untuk memulai `PHASE 7 — APPROVAL` (endpoint
approve/reject untuk `approval_requests` yang sejak PHASE 5 sudah
diparkir di `PENDING_APPROVAL` — memindahkannya ke `POSTED` atau kembali
`DRAFT`/`REJECTED`, dengan aturan creator ≠ approver yang sudah dijaga DB
CHECK constraint sejak PHASE 2/D16).
