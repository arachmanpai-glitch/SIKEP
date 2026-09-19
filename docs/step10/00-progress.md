# PHASE 10 — SECURITY HARDENING: Acceptance Checklist

Status: **SELESAI** (2026-09-19). Menunggu review/perintah `LANJUT PHASE 11`.

## Acceptance Criteria

Dicek satu per satu terhadap checklist spec section 15:

- [x] Secure authentication — Argon2id + JWT stateless (PHASE 3), tidak berubah
- [x] HttpOnly cookie — `sikep_session` (PHASE 3), diverifikasi ulang
- [x] Secure cookie — `secure: isProduction` di `lib/auth/cookies.ts` (PHASE 3), diverifikasi ulang
- [x] SameSite — `sameSite: "lax"` kedua cookie (PHASE 3), diverifikasi ulang
- [x] Session expiration — 8 jam (`SESSION_MAX_AGE_SECONDS`, PHASE 3), diverifikasi ulang
- [x] Password hashing Argon2id — `@node-rs/argon2` (PHASE 3), diverifikasi ulang
- [x] Server-side RBAC — `requireSession`/`requireRole` di SETIAP route kecuali
      login (diaudit ulang via grep, 100% cakupan, tidak ada celah)
- [x] Tenant isolation — `schoolId` dari session, tidak pernah dari client (PHASE 3-4)
- [x] IDOR protection — diaudit ulang: TIDAK ADA `findFirst`/`update`/`delete`
      dengan `where: { id }` saja tanpa `schoolId` di seluruh `repositories/`
- [x] Validation — Zod di setiap route (PHASE 4+), diverifikasi ulang
- [x] Rate limiting — login 5x/15 menit per IP+email (PHASE 3), tetap dipertahankan
      hanya di login (D64) — endpoint lain sudah dilindungi session+RBAC+CSRF
- [x] CSRF protection — diaudit ulang: SETIAP route `POST`/`PATCH`/`DELETE`
      memanggil `requireCsrf` KECUALI login (benar, belum ada sesi)
- [x] XSS protection — diverifikasi TIDAK ADA `dangerouslySetInnerHTML` di
      seluruh codebase + **BARU**: `Content-Security-Policy` header (D61)
- [x] SQL injection protection — Prisma parameterized query di semua tempat (tidak berubah)
- [ ] Private object storage — TIDAK diimplementasikan (lihat catatan scope di bawah)
- [ ] Signed URLs — TIDAK diimplementasikan (terkait poin di atas)
- [x] Audit log — sudah berjalan sejak PHASE 5, dibaca PHASE 9 (tidak berubah)
- [x] **BARU**: Security headers menyeluruh — `X-Frame-Options: DENY`,
      `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
      `Permissions-Policy`, `Strict-Transport-Security` (production only)
- [x] **BARU**: `poweredByHeader: false` — `X-Powered-By` tidak lagi dikirim
- [x] **BARU**: `npm audit` diverifikasi ulang — temuan sama seperti PHASE 8, tidak ada yang baru

## Catatan Scope: Object Storage / Signed URLs

Modul "Bukti Transaksi" (spec section 6) — yang membutuhkan private object
storage (S3-compatible) dan signed URL (spec section 15) — **tidak pernah
dijadwalkan di salah satu dari 12 nama phase** pada urutan resmi (`PHASE 1
FOUNDATION` ... `PHASE 12 PRODUCTION`, spec section 20). Tabel
`transaction_attachments` sudah ada di skema sejak PHASE 2 (dengan kolom
`storageKey` yang secara desain BUKAN URL publik), tapi belum ada satu pun
endpoint upload/download yang memakainya.

PHASE 10 ("SECURITY HARDENING") menghardening kontrol keamanan yang SUDAH
ADA — bukan membangun modul baru yang belum dijadwalkan di mana pun.
Membangun integrasi S3 + signed URL sekarang berarti scope-creep yang
signifikan (dependency AWS SDK baru, endpoint upload/download baru, alur
otorisasi baru) yang tidak diminta eksplisit. Ini dicatat sebagai **gap
yang disadari**, bukan celah yang terlewat — kandidat untuk instruksi
eksplisit terpisah kapan pun dibutuhkan.

## Hasil Validasi

| Perintah            | Hasil                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`      | ✅ 0 error                                                                                                                                        |
| `npm run typecheck` | ✅ 0 error                                                                                                                                        |
| `npm run test`      | ✅ (lihat hasil final di bawah)                                                                                                                   |
| `npm run build`     | ✅ build production sukses, pola static/dynamic rendering TIDAK berubah (CSP statis, bukan nonce)                                                 |
| Preview browser     | ✅ Header CSP/X-Frame-Options/dll terverifikasi ada di response asli; `/login` dan `/dashboard` dicek visual — tidak ada CSP violation di console |

## Temuan & Keputusan Selama Pengerjaan (self-review)

1. **PHASE 10 murni audit + satu penambahan konfigurasi** — bukan phase
   yang menambah service/route/tabel baru seperti PHASE 5-9. Sebagian
   besar checklist spec section 15 ternyata SUDAH terpenuhi sejak PHASE
   3-4 lewat disiplin arsitektur; audit sistematis (grep terhadap semua
   `app/api/v1/**/route.ts` dan `repositories/*.ts`) tidak menemukan satu
   pun celah CSRF/RBAC/IDOR — hasilnya murni bukti dokumentasi, bukan
   perbaikan bug.
2. **Keputusan terpenting (D61)**: CSP statis dipilih atas CSP berbasis
   nonce yang lebih ketat, karena dokumentasi resmi Next.js menyatakan
   nonce MEWAJIBKAN semua halaman dirender dinamis — trade-off performa
   besar (kehilangan static rendering di hampir semua halaman) untuk
   manfaat keamanan marginal di aplikasi ini secara spesifik (tidak ada
   `dangerouslySetInnerHTML` di mana pun, diverifikasi lewat grep).
3. **Keputusan scope terpenting**: private object storage/signed URL
   (bagian dari checklist section 15) SENGAJA tidak dibangun karena
   modul "Bukti Transaksi" yang membutuhkannya tidak pernah dijadwalkan
   di salah satu dari 12 nama phase resmi — dicatat sebagai gap yang
   disadari, bukan diam-diam dilewati.
4. **`next.config.ts` memakai relative import** (`./lib/security-headers`),
   bukan alias `@/*` — karena `next.config.ts` dimuat oleh bootstrap Next
   sendiri sebelum resolusi alias webpack/tsconfig tersedia. Diverifikasi
   lewat `npm run build` sukses (kalau importnya gagal resolve, build
   akan gagal total, bukan cuma warning).
5. **Diverifikasi visual di browser**: CSP statis tidak merusak apa pun —
   halaman `/login` dan `/dashboard` (redirect) dicek, tidak ada CSP
   violation di console, styling & HMR websocket tetap berfungsi normal.

## Next Step

Ketik **`LANJUT PHASE 11`** untuk memulai `PHASE 11 — TESTING`.
