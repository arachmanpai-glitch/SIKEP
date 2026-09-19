# PHASE 8 — DASHBOARD + REPORT: Acceptance Checklist

Status: **SELESAI** (2026-09-19). Menunggu review/perintah `LANJUT PHASE 9`.

## Acceptance Criteria

- [x] `GET /api/v1/dashboard/summary` — saldo per akun aktif + total, saldo
      dihitung lewat `getAccountBalance` yang sama persis dengan PHASE 5
      (bukan rumus baca terpisah, D49)
- [x] Dashboard menampilkan pemasukan/pengeluaran bulan berjalan, jumlah
      approval `PENDING`, ringkasan status tagihan santri (UNPAID/PARTIAL/
      PAID + total piutang), tren 6 bulan terakhir, dan 10 transaksi terbaru
- [x] UI `/dashboard` — kartu ringkasan + `BarChart` (pemasukan vs
      pengeluaran) + `PieChart` (status tagihan), keduanya Recharts (spec
      section 7)
- [x] `GET /api/v1/reports/financial?from=&to=` — pemasukan/pengeluaran
      `POSTED` dikelompokkan per kategori, dengan total & net
- [x] `GET /api/v1/reports/billing?academicYearId=&classId=&status=` — satu
      baris per tagihan santri, semua filter opsional
- [x] Export PDF (`lib/reports/pdf.ts`, pdfkit) dan XLSX
      (`lib/reports/xlsx.ts`, exceljs) untuk kedua laporan — Buffer
      langsung ke response, tidak pernah menulis file ke disk (D51)
- [x] Endpoint export mencatat audit `EXPORT` (D50) — 1 dari 12 audit
      action spec section 16 yang baru sekarang terpakai
- [x] UI `/laporan` — filter tanggal/tahun-ajaran/kelas/status + tombol
      Export PDF/XLSX yang memanggil endpoint export langsung (GET, tanpa
      CSRF)
- [x] Semua endpoint baru terbuka untuk role manapun yang login (D52),
      konsisten dengan pola GET sejak PHASE 5 — tidak ada mutasi baru di
      phase ini
- [x] Tenant isolation konsisten (semua query di-scope `schoolId` dari
      session, tidak pernah dari input client)

## Hasil Validasi

| Perintah            | Hasil                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`      | ✅ 0 error                                                                                                                                   |
| `npm run typecheck` | ✅ 0 error                                                                                                                                   |
| `npm run test`      | ✅ 239/239 test lolos (46 file, +21 baru)                                                                                                    |
| `npm run build`     | ✅ build production sukses, 35 route (6 baru: dashboard/summary, reports/financial(+export), reports/billing(+export), /dashboard, /laporan) |
| Preview browser     | ✅ `/api/v1/dashboard/summary`, `/api/v1/reports/*` → 401 JSON saat belum login; `/dashboard`, `/laporan` → redirect ke `/login?next=...`    |

## Temuan & Keputusan Selama Pengerjaan (self-review)

1. **Tidak ada spesifikasi granular untuk PHASE 8** di prompt bootstrap
   selain nama phase ("DASHBOARD + REPORT"), daftar modul (spec section 6:
   "Dashboard", "Laporan") dan tech baseline (spec section 7: Recharts,
   Server-side PDF, XLSX) — scope konkret (apa saja yang ditampilkan,
   endpoint apa saja, library mana) ditentukan sendiri mengikuti prinsip
   "pilih default engineering paling aman, dokumentasikan" (bootstrap rule
   24). Semua keputusan itu dicatat sebagai D49-D53.
2. **Keputusan finansial penting (D49)**: saldo per akun di dashboard
   SENGAJA memakai ulang `getAccountBalance` + `Serializable` retry yang
   sama dengan PHASE 5, bukan rumus baca-saja yang baru — supaya tidak ada
   dua tempat berbeda yang menghitung "saldo akun" (bootstrap rule 10).
   Konsekuensi yang disadari dan diterima: `GET /api/v1/dashboard/summary`
   bisa menulis satu baris `OPENING_BALANCE` di request pertamanya untuk
   akun yang belum pernah diposting — self-healing by design, bukan bug.
3. **Keputusan keamanan/audit (D50)**: dua endpoint export adalah
   satu-satunya rute GET di seluruh codebase yang punya efek samping tulis
   (audit `EXPORT`) — dibatasi ketat hanya ke `audit_logs` (insert-only,
   immutable), tidak pernah ke data domain. Alternatif (mewajibkan POST
   untuk export) ditolak karena janggal untuk sebuah file download yang
   dipicu link `<a href>` biasa.
4. **Pemilihan library (D51)**: `pdfkit` (bukan Puppeteer — lebih ringan,
   tanpa headless browser) dan `exceljs` (bukan `xlsx`/SheetJS — riwayat
   CVE prototype-pollution). `npm audit` menemukan 1 advisory moderate
   (`uuid` transitif lewat `exceljs`) yang TIDAK diperbaiki paksa karena
   perbaikannya breaking change (downgrade `exceljs`) dan kode SIKEP tidak
   pernah menyentuh fungsi `uuid` yang rentan — didokumentasikan, bukan
   diabaikan diam-diam.
5. **Perbaikan dokumentasi insidental**: satu baris di
   `docs/development.md` yang menyebut audit log "diimplementasikan
   PHASE 9" sudah usang (audit sudah berjalan sejak PHASE 5) — diperbaiki
   sambil mengedit file yang sama untuk PHASE 8, bukan scope baru.
6. **Keterbatasan yang disadari (D53)**: batas tanggal (tren bulanan,
   filter laporan) memakai kalender UTC, bukan konversi Asia/Jakarta yang
   sesungguhnya — konsisten dengan bagian lain aplikasi yang juga belum
   melakukan konversi timezone eksplisit untuk batas tanggal. Perbaikan
   menyeluruh (kalau dibutuhkan) adalah scope PHASE 9/10, bukan PHASE 8.

## Next Step

Ketik **`LANJUT PHASE 9`** untuk memulai `PHASE 9 — RECONCILIATION + AUDIT`
(UI untuk melihat `audit_logs` yang sudah ditulis sejak PHASE 5, rekonsiliasi
kas/bank, penutupan periode finansial).
