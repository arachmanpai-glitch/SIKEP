# PHASE 3 — AUTH + RBAC: Acceptance Checklist

Status: **SELESAI** (2026-09-18). Menunggu review/perintah `LANJUT PHASE 4`.

## Acceptance Criteria

- [x] Password hashing Argon2id (`lib/auth/password.ts`, `@node-rs/argon2`)
- [x] Session cookie: HttpOnly, Secure (production), SameSite=Lax, expiry
      8 jam (`lib/auth/session.ts`, `lib/auth/cookies.ts`)
- [x] RBAC server-side: `requireSession()`/`requireRole()` di
      `lib/rbac.ts`, dipakai di semua route `/api/v1/auth/*`
- [x] IDOR guard: `requireSameSchool()` — tersedia & di-test, siap dipakai
      route/service PHASE 4+
- [x] Tenant isolation: `schoolId` selalu dari session, tidak pernah dari
      client (tidak ada endpoint yang menerima `schoolId` dari body/query)
- [x] CSRF: double-submit cookie (`lib/auth/csrf.ts`), diterapkan di
      `/api/v1/auth/logout` sebagai referensi
- [x] Rate limiting login: 5 percobaan/15 menit per IP+email
      (`lib/auth/rate-limit.ts`)
- [x] Tidak ada user enumeration: pesan error generik untuk email tak
      ditemukan/password salah/akun nonaktif, dengan timing dinormalisasi
      (dummy Argon2id verify)
- [x] `proxy.ts` (rename dari `middleware.ts` — ditemukan sendiri lewat
      deprecation warning Next.js 16 saat build) sebagai gerbang UX,
      **bukan** batas otorisasi — dibuktikan lewat pengujian manual
- [x] Role tetap 3: ADMIN/BENDAHARA/YAYASAN (`constants/roles.ts`,
      `prisma/seed.ts`) — tidak ada istilah role lain
- [x] `AUTH_SECRET` wajib divalidasi Zod (`lib/env.ts`), gagal start
      dengan pesan jelas jika tidak diisi/terlalu pendek
- [x] Halaman `/login` + tombol logout, homepage session-aware
- [x] Test unit menyeluruh untuk password/session/csrf/rate-limit/
      validation/rbac/AuthService — tanpa perlu database nyata

## Hasil Validasi

| Perintah            | Hasil                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`      | ✅ 0 error                                                                                                                                                                  |
| `npm run typecheck` | ✅ 0 error                                                                                                                                                                  |
| `npm run test`      | ✅ 77/77 test lolos (13 file, +36 baru)                                                                                                                                     |
| `npm run build`     | ✅ build production sukses (setelah 2 fix, lihat di bawah)                                                                                                                  |
| Preview browser     | ✅ login page render benar, error DB ditangani rapi (500 generik, bukan crash), redirect proxy ke `/login` untuk path terproteksi, `/api/v1/auth/me` → 401 saat belum login |

## Temuan & Perbaikan Selama Pengerjaan (self-review)

1. **Bug ditemukan & diperbaiki**: `useSearchParams()` di halaman `/login`
   awalnya tidak dibungkus `<Suspense>` — `npm run build` gagal saat
   prerender. Diperbaiki dengan memisahkan form ke komponen `LoginForm`
   yang dibungkus `<Suspense>`.
2. **Perubahan framework ditemukan & diadaptasi**: `npm run build`
   memunculkan deprecation warning bahwa `middleware.ts` sudah digantikan
   `proxy.ts` di Next.js 16 (fungsi `middleware` → `proxy`). File
   di-rename & disesuaikan; juga dicatat bahwa `proxy.ts` kini default ke
   Node.js runtime, bukan Edge (D23).
3. **Isu TypeScript ditemukan & diperbaiki**: `Algorithm` dari
   `@node-rs/argon2` adalah `const enum` yang tidak bisa diakses sebagai
   value di bawah `isolatedModules` (dipakai Next.js/SWC) — diganti nilai
   numerik literal dengan komentar penjelas.
4. Login penuh (submit → session valid) **tidak bisa diuji end-to-end**
   di environment ini karena tidak ada PostgreSQL nyata (konsisten dengan
   keterbatasan PHASE 2, D14) — yang divalidasi via browser adalah: UI
   render benar, validasi Zod client+server, dan bahwa kegagalan koneksi
   DB ditangani sebagai 500 generik (bukan crash/bocor kredensial) berkat
   fondasi `lib/api-response.ts` dari PHASE 1.

## Next Step

Ketik **`LANJUT PHASE 4`** untuk memulai `PHASE 4 — MASTER DATA` (CRUD
untuk kelas, tahun ajaran, akun keuangan, sumber dana, kategori, jenis
tagihan; seed jenis tagihan awal; halaman manajemen user oleh Admin).
