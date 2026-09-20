# Catatan Keputusan Teknis (ADR ringkas)

Format: keputusan → alasan. Hanya keputusan yang tidak trivial/tidak diatur
eksplisit oleh spesifikasi SIKEP dicatat di sini.

## PHASE 1 — Foundation

**D1. Scaffold dengan `create-next-app` (App Router, Tailwind v4, ESLint),
lalu disesuaikan manual untuk layering domain.**
Alasan: baseline resmi Next.js paling stabil untuk App Router + Tailwind v4
(CSS-first config, tanpa `tailwind.config.js`); struktur `services/`,
`repositories/`, `types/`, `constants/` ditambahkan manual di atasnya sesuai
layering yang diwajibkan spesifikasi.

**D2. Pin `prisma` CLI ke `7.10.0` agar sama persis dengan `@prisma/client`.**
Alasan: `npm install -D prisma` awalnya menarik `8.0.0-rc.x` (release
candidate) sementara `@prisma/client` stabil di `7.10.0` — version skew
antara CLI dan client berisiko pada `prisma generate`/`migrate` di PHASE 2.
Dipin ke versi stabil yang sama.

**D3. Model database belum dibuat di `prisma/schema.prisma`.**
Alasan: sesuai urutan phase, `PHASE 2 — DATABASE` yang membangun seluruh
model (`schools`, `users`, `santri`, `financial_ledger`, dst). PHASE 1 hanya
menyiapkan koneksi (`datasource`/`generator`) agar `prisma generate` bisa
dijalankan tanpa error.

**D4. Konstanta domain (role, kelas K1-K6/Pengabdian, jenis tagihan) TIDAK
dibuat sebagai hard-coded constants di `constants/`.**
Alasan: spesifikasi eksplisit melarang financial logic hard-coded
berdasarkan nama tagihan/role, dan mewajibkan role/kelas/jenis tagihan
sebagai master data configurable di database. `constants/app.ts` hanya
berisi konstanta infrastruktur (nama app, currency, timezone, API version).

**D5. Logger memakai Pino, bukan `console.*`.**
Alasan: dibutuhkan structured logging (JSON) dengan redaksi field sensitif
(password/token/secret) untuk memenuhi aturan keamanan audit-friendly di
PHASE 9/10, dan agar log bisa di-pipe ke agregator di production.

**D6. Test framework: Vitest, bukan Jest.**
Alasan: setup lebih ringan untuk proyek Next.js App Router + TypeScript ESM,
tanpa konfigurasi transform tambahan. Unit test PHASE 1 menguji kode
foundation yang nyata (`lib/errors.ts`, `lib/api-response.ts`,
`lib/env.ts`, `constants/app.ts`), bukan test dummy.

**D7. `shadcn/ui` disiapkan sebagai foundation (`components.json`,
`lib/utils.ts` / `cn()`, dependency `clsx`+`tailwind-merge`+
`class-variance-authority`+`lucide-react`) tanpa menarik komponen UI
konkret.**
Alasan: komponen ditambahkan per modul saat modul tersebut dikerjakan
(mulai PHASE 4+), sesuai aturan "jangan membangun scope melebar" — foundation
hanya menyiapkan jalur agar `npx shadcn add <komponen>` langsung bisa jalan.

**D8. Auth.js / NextAuth belum diinstal di PHASE 1.**
Alasan: `PHASE 3 — AUTH + RBAC` adalah pemilik desain autentikasi (strategi
session, Argon2id, cookie policy). `.env.example` sudah menyiapkan slot
`AUTH_SECRET` agar tidak ada perubahan skema env yang mengejutkan nanti.

**D9. 4 kerentanan `npm audit` (severity high) diterima sementara —
seluruhnya transitif dari `prisma` CLI (devDependency), tidak ter-expose
ke runtime/production.**

Rincian per 2026-09-18:

| Package        | Kerentanan                                                                         | Sumber                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `mysql2`       | Auth plugin downgrade dapat membocorkan credential plaintext (GHSA-3f6p-5ww8-9rcr) | Dibundel `prisma` CLI untuk introspeksi/migrasi MySQL — proyek ini memakai PostgreSQL, driver ini tidak pernah dipanggil kode kita |
| `deepmerge-ts` | Stack exhaustion pada merge objek rekursif (GHSA-ggr8-5vv4-36mx)                   | Dipakai `@prisma/config` saat memuat `prisma.config.ts` — input berasal dari file config milik developer, bukan dari user/attacker |

Keduanya berada di rantai dependency `prisma` (CLI, devDependency untuk
`generate`/`migrate`/`studio`), **bukan** `@prisma/client`/`@prisma/adapter-pg`/`pg`
yang dipakai runtime aplikasi (`lib/prisma.ts`) — tidak ikut ter-bundle ke
`.next/` production build.

`npm audit fix --force` yang ditawarkan npm sebenarnya adalah **downgrade
mayor** `prisma` ke `6.19.3`, bukan upgrade — itu akan mengembalikan pola
`datasource.url` lama yang sudah sengaja kita tinggalkan (lihat D2) dan
kontradiktif dengan arsitektur driver-adapter Prisma 7 yang sudah
diimplementasikan & diuji. Downgrade mayor tanpa alasan kuat lebih
berisiko daripada kerentanan dev-tooling yang tidak ter-expose ini.

Keputusan: diterima sementara, tidak di-downgrade. Ditinjau ulang setiap
kali `prisma` merilis versi patch baru (`npm outdated prisma` /
`npm audit`) — bukan diam-diam diabaikan.

**D10. (Ditemukan saat FINAL REVIEW) `.gitignore` bawaan `create-next-app`
memakai pola `.env*` yang turut meng-ignore `.env.example`.**
Alasan: `.env.example` adalah template tanpa secret dan harus ikut
di-commit supaya developer/CI lain tahu variabel env yang dibutuhkan.
Diperbaiki dengan menambah baris `!.env.example` setelah `.env*` di
`.gitignore` — `.env` (dan varian nyata lain seperti `.env.local`) tetap
ter-ignore, hanya `.env.example` yang dikecualikan.

## PHASE 2 — Database

**D11. Primary key: `String @default(uuid()) @db.Uuid`, bukan
`gen_random_uuid()` sisi database.**
Alasan: UUID dibuat Prisma Client (JS, v4) sebelum INSERT — tidak
bergantung pada versi PostgreSQL atau extension (`gen_random_uuid()` baru
built-in sejak PG 13), dan nilai id tersedia di aplikasi sebelum query
dijalankan (berguna untuk membangun graph relasi dalam satu
`$transaction`). Trade-off: generasi ID pindah ke proses Node, bukan DB —
diterima karena semua tulisan tetap lewat service layer, tidak ada insert
langsung dari luar aplikasi.

**D12. Role disimpan sebagai tabel referensi global (`roles`, tanpa
`school_id`) berisi tepat 3 baris (ADMIN/BENDAHARA/YAYASAN), bukan enum
Prisma, dan bukan tabel per-tenant.**
Alasan: spesifikasi section 13 secara eksplisit mendaftar `roles` sebagai
tabel wajib, sehingga enum murni akan menyimpang dari struktur DB yang
diminta. Tapi section 3 mengunci "hanya ada 3 role utama" — kontradiktif
dengan filosofi "role harus configurable". Kompromi: tabel referensi
global (bukan per-sekolah, bukan diedit lewat UI Admin) dengan kolom
`code` unik yang dipakai kode aplikasi (bukan UUID hard-coded) — integritas
referensial tetap terjaga lewat FK `users.role_id`, sekaligus tidak
memungkinkan satu sekolah membuat role ke-4. Seed 3 baris dilakukan PHASE 4.

**D13. `ClassLevel` (K1-K6, PENGABDIAN) adalah Prisma enum, bukan tabel
configurable seperti `bill_types`.**
Alasan: spec section 4 menyebut struktur ini "struktur resmi... struktur
utama SIKEP" tanpa kata "configurable" — berbeda eksplisit dari section 5
yang menyatakan jenis tagihan "harus configurable". Enum memberi type
safety & mencegah nilai kelas yang salah ketik masuk ke financial
reporting. Trade-off yang disadari: menambah level kelas baru di masa
depan butuh migration, bukan sekadar INSERT baris — diterima karena
struktur ini memang dinyatakan resmi/tetap oleh spesifikasi.

**D14. Tidak ada PostgreSQL/Docker yang berjalan di environment
pengembangan ini — skema divalidasi & diuji tanpa live database.**
Alasan/metode: `npx prisma validate` + `npx prisma generate` memvalidasi
sintaks dan seluruh relasi (termasuk mendeteksi ambiguitas relasi) tanpa
koneksi DB. Migration SQL awal dibuat dengan
`prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`
(mode diff murni terhadap schema file, tidak menghubungi server manapun),
disimpan sebagai `prisma/migrations/20260918000000_init/migration.sql` +
`migration_lock.toml` mengikuti format migration history Prisma standar,
sehingga begitu `DATABASE_URL` menunjuk ke PostgreSQL nyata,
`npm run db:migrate` / `prisma migrate deploy` bisa langsung memakainya.
Test schema-shape (`tests/unit/prisma/migration.test.ts`) memvalidasi DDL
SQL ini secara langsung (bukan lewat DMMF Prisma Client — DMMF runtime di
Prisma ORM v7 ternyata sudah dipangkas dan tidak lagi menyertakan metadata
unique/native-type, lihat komentar di file test). Test concurrency/
idempotency terhadap database sungguhan (spec section 18) tetap ditunda ke
PHASE 5/6 sesuai D6, karena baru di situ ada service layer yang benar-benar
menulis ke DB.

**D15. `approval_requests.reason` (wajib diisi saat status REJECTED) tidak
dipaksa lewat DB CHECK constraint — divalidasi Zod di service layer
(PHASE 7).**
Alasan: aturan ini bersyarat pada kolom lain (`status`) dan lebih natural
dibaca & di-unit-test di lapisan service bersama logic approval lainnya,
dibanding CHECK multi-kondisi yang sulit dibaca di SQL mentah. Beda dengan
D16 di bawah — trade-off ini diambil per aturan, bukan blanket policy.

**D16. `approval_requests` mendapat DB-level `CHECK` constraint tambahan
(`decided_by_id IS NULL OR decided_by_id <> requested_by_id`), ditambahkan
manual ke `migration.sql` karena `schema.prisma` (di luar preview feature)
tidak punya sintaks CHECK constraint.**
Alasan: "Bendahara/creator tidak boleh menjadi approver transaksi sendiri"
adalah aturan financial-integrity inti (prioritas #2) yang murah untuk
dipertahankan sebagai defense-in-depth di level database, di atas validasi
service layer PHASE 7. **Peringatan operasional**: karena constraint ini
tidak direpresentasikan di `schema.prisma`, `prisma migrate dev` di masa
depan (saat sudah ada DB nyata) berpotensi tidak menyadari constraint ini
saat melakukan diff dan bisa mengusulkan untuk men-drop-nya — review setiap
output `prisma migrate diff`/`migrate dev` sebelum apply, khususnya bila
menyentuh tabel `approval_requests`, agar constraint ini tidak hilang tanpa
sengaja.

**D17. Ditemukan & diperbaiki sebelum commit: rancangan awal
`transaction_attachments` memakai satu kolom `entity_id` dengan DUA
foreign key sekaligus (ke `income_transactions` dan `expense_transactions`)
— relasional tidak mungkin terpenuhi (satu UUID tidak bisa jadi primary
key di dua tabel berbeda secara bersamaan).**
Alasan/fix: diganti mengikuti pola yang sudah dipakai `financial_ledger` —
`entity_type`/`entity_id` jadi pointer generik yang TIDAK di-FK-kan (hanya
untuk query), sedangkan relasi sungguhan lewat tiga kolom nullable terpisah
(`income_transaction_id`, `expense_transaction_id`, `santri_payment_id`),
masing-masing dengan FK sendiri. Tepat satu di antaranya wajib terisi
sesuai `entity_type`, divalidasi Zod di service layer (PHASE 6/9). Ditest
eksplisit di `tests/unit/prisma/migration.test.ts` agar regresi pola yang
sama tidak lolos lagi.

## PHASE 3 — Auth + RBAC

**D18. Session berupa JWT stateless (HS256, ditandatangani dengan
`AUTH_SECRET`) di cookie HttpOnly, BUKAN session record di database.**
Alasan: spesifikasi section 13 (daftar tabel minimum) tidak menyebut tabel
`sessions` — membuatnya sendiri berarti menyimpang dari struktur DB yang
diminta tanpa alasan kuat. JWT stateless berarti setiap request cukup
verifikasi signature+expiry (`lib/auth/session.ts`), tanpa round-trip DB,
dan bisa dijalankan di Edge/Proxy sebelum request sampai ke aplikasi.
**Trade-off yang disadari**: perubahan role/status akun tidak langsung
berlaku untuk sesi yang sudah terbit sampai token itu expire atau user
login ulang — diterima karena masa berlaku token pendek (lihat D19).
Revocation list (butuh tabel baru) bisa ditambahkan di PHASE 10 SECURITY
HARDENING kalau kebutuhan "paksa logout semua device" muncul nanti.

**D19. Masa berlaku session 8 jam (`SESSION_MAX_AGE_SECONDS`), rate limit
login in-memory (5 percobaan/15 menit per kombinasi IP+email).**
Alasan: 8 jam ≈ satu hari kerja pesantren, cukup pendek untuk membatasi
dampak D18 di atas, cukup panjang agar Bendahara tidak berulang kali
login. Rate limiter in-memory (`lib/auth/rate-limit.ts`) sengaja minimal
untuk deployment single-instance — state hilang saat restart/tidak
konsisten lintas instance kalau di-scale horizontal; dicatat sebagai
scaling trap yang harus dipindah ke store bersama (mis. Redis) sebelum
deployment multi-instance, bukan trade-off yang didiamkan.

**D20. Pesan error login SELALU generik ("Email atau password salah.")
untuk: email tidak ditemukan, password salah, DAN akun nonaktif — dengan
Argon2id verify() dummy dijalankan bahkan saat user tidak ditemukan.**
Alasan: mencegah user enumeration (OWASP) dan mencegah timing side-channel
(tanpa dummy-verify, jalur "user tidak ada" akan jauh lebih cepat daripada
jalur "password salah" yang menjalankan Argon2id, membocorkan info lewat
waktu respons). Trade-off: admin tidak mendapat pesan spesifik "akun
dinonaktifkan" saat mencoba login — diterima karena ini aplikasi keuangan
internal dengan basis user kecil/terkontrol, bukan aplikasi publik; admin
lain bisa mengecek status akun lewat panel Admin (PHASE 4+), bukan lewat
pesan error login.

**D21. Password hashing pakai `@node-rs/argon2` (prebuilt native binding,
napi-rs), bukan paket `argon2` (node-gyp, compile dari source).**
Alasan: environment pengembangan ini tidak selalu punya toolchain C++
untuk node-gyp (terutama Windows) — `@node-rs/argon2` menyediakan binary
prebuilt untuk platform umum sehingga `npm install` tidak berisiko gagal
di CI/mesin developer lain. Parameter Argon2id (m=19MiB, t=2, p=1)
mengikuti rekomendasi minimum OWASP terbaru.

**D22. JWT session pakai library `jose`, bukan `jsonwebtoken`.**
Alasan: `middleware.ts`/`proxy.ts` (PHASE 3 memakainya sebagai coarse
route gate) awalnya berjalan di Edge runtime yang tidak punya Node `crypto`
penuh — `jose` didesain Edge-compatible, `jsonwebtoken` tidak. Next.js 16
mengubah `proxy.ts` menjadi default Node.js runtime (lihat D23), tapi
`jose` tetap dipertahankan karena sudah bekerja baik dan tidak ada alasan
kuat untuk mengganti sesuatu yang sudah benar.

**D23. `middleware.ts` di-rename menjadi `proxy.ts` (fungsi `middleware`
menjadi `proxy`) — ditemukan sendiri lewat warning deprecation saat
`npm run build`, bukan diberi tahu di spesifikasi awal.**
Alasan: Next.js 16 (versi yang ter-install di PHASE 1, `16.3.5`) resmi
me-rename konvensi file ini; `middleware.ts` masih berfungsi tapi
menghasilkan warning deprecation di setiap build. Sekaligus dicatat:
`proxy.ts` sekarang default ke Node.js runtime (bukan Edge lagi) — tidak
mengubah logic kita karena `lib/auth/session.ts` sudah edge-safe sejak
awal, tapi artinya constraint "tidak boleh pakai Prisma di sini" sudah
tidak seketat dulu (belum dimanfaatkan, dicatat untuk phase berikutnya).

**D24. Proxy (`proxy.ts`) adalah gerbang UX kasar (redirect ke `/login`),
BUKAN batas otorisasi sesungguhnya — setiap route/API tetap wajib panggil
`requireSession()`/`requireRole()` sendiri (`lib/rbac.ts`).**
Alasan: mengandalkan middleware/proxy sebagai satu-satunya lapisan
otorisasi adalah kelas bug yang sudah beberapa kali terjadi di ekosistem
Next.js (route bisa dicapai lewat jalur yang tidak selalu dilalui
middleware). Dibuktikan lewat pengujian manual: `/api/v1/auth/me` sengaja
dikecualikan dari redirect proxy (masuk daftar path publik) namun tetap
mengembalikan 401 yang benar karena `requireSession()` di dalam route
handler-nya sendiri yang menegakkan otorisasi. Lihat "Keamanan" di
`docs/architecture.md`.

## PHASE 4 — Master Data

**D25. 6 tabel master data yang strukturnya identik (academic_years,
classes, financial_accounts, fund_sources, transaction_categories,
bill_types — semuanya: tenant-scoped, soft-deletable, di-CRUD Admin, setiap
mutasi di-audit) memakai SATU generic service engine
(`services/masterDataService.ts`), bukan 6 service terpisah yang isinya
duplikat.**
Alasan: keenamnya secara struktural benar-benar sama di lapisan
orkestrasi (validasi → tenant-scoping → audit) — menulis ulang logic yang
identik 6 kali melanggar aturan "jangan duplicate" dan membuat 6 tempat
terpisah yang harus dijaga konsisten (mis. kalau aturan IDOR berubah, ada
6 file yang harus diubah, bukan 1). Setiap entity hanya menyediakan
`MasterDataAdapter` (Prisma call yang memang genuinely berbeda per model)
lewat `repositories/masterDataAdapters.ts`; orkestrasi CRUD+audit+IDOR
dipakai bersama. Santri (D26) dan User (D27) TIDAK dipaksa masuk pola ini
karena business rule-nya nyata berbeda (lihat masing-masing).

**D26. Santri memakai ULANG engine generic yang sama (D25) lewat
`services/SantriService.ts`, tapi tetap dapat URL API terpisah
(`/api/v1/santri`, bukan `/api/v1/master-data/santri`).**
Alasan: secara struktural PHASE 4 Santri memang hanya CRUD tenant-scoped
sederhana (billing/pembayaran yang punya business rule sungguhan baru
masuk PHASE 6) — jadi reuse engine tetap valid. Tapi spec section 6
memperlakukan "Data Santri" sebagai modul utama tersendiri, bukan
konfigurasi generik ala Admin — jadi dapat path URL sendiri untuk
kejelasan API, tanpa duplikasi implementasi.

**D27. User TIDAK memakai engine generic (D25) — `services/UserService.ts`
custom.**
Alasan: user punya 2 hal yang generic engine tidak punya tempatnya:
resolusi `roleCode` (string) → `roleId` (FK, lewat `findRoleByCode`, D12)
dan hashing password (`createPasswordHash` dari `AuthService`, D21) — baik
create maupun update. Juga ada aturan bisnis yang genuinely unik: Admin
tidak boleh menonaktifkan akunnya sendiri. Memaksa ini ke generic adapter
akan membuat adapter itu tidak lagi "adapter tipis" tapi bocor logic
bisnis ke lapisan repository — jadi custom service adalah pilihan yang
lebih bersih. `passwordHash` juga tidak pernah keluar dari
`UserService.ts` — semua fungsi mengembalikan `PublicUser`, bukan baris
Prisma mentah.

**D28. `CONFIG_CHANGE` (bukan `UPDATE`) dipakai khusus untuk audit
perubahan `approval_settings`.**
Alasan: spec section 16 secara eksplisit mendaftar `CONFIG_CHANGE` sebagai
audit action tersendiri, terpisah dari `UPDATE` biasa — masuk akal karena
mengubah threshold approval memengaruhi SEMUA transaksi pengeluaran masa
depan di sekolah itu, bukan satu baris data seperti mengedit nama kelas.

**D29. `bill_types` default (12 item, spec section 5) TIDAK di-seed
otomatis oleh `prisma/seed.ts` global — hanya jalan jika `SEED_SCHOOL_ID`
di-set.**
Alasan: `bill_types` adalah tabel tenant-scoped (`school_id`), sedangkan
`prisma/seed.ts` yang sama dipakai untuk seed `roles` yang genuinely
global — tidak ada "sekolah default" yang bisa diasumsikan di seed
generik. Daripada menciptakan flow "provisioning sekolah baru" yang tidak
diminta spec (scope creep), fungsi ini dibuat sebagai langkah eksplisit
opsional (`SEED_SCHOOL_ID=<uuid> npm run db:seed`) yang dijalankan setelah
baris `schools` pertama dibuat — didokumentasikan di
`docs/development.md`.

**D30. (Ditemukan sendiri, diperbaiki sebelum melapor) `proxy.ts` awalnya
me-redirect SEMUA path terproteksi (termasuk `/api/v1/**` non-auth) ke
halaman HTML `/login` saat tidak ada sesi — termasuk endpoint yang
dipanggil lewat `fetch()` dari client component (`lib/client/api.ts`),
yang mengharapkan body JSON `{ success, data|error }`.**
Alasan/fix: `response.json()` di sisi client akan gagal parse HTML,
menghasilkan error yang membingungkan alih-alih pesan 401 yang rapi.
Diperbaiki: `proxy.ts` sekarang mengecualikan SELURUH `/api/**` dari
redirect — endpoint API selalu mengembalikan JSON dari
`requireSession()`/`requireRole()` miliknya sendiri (lewat
`handleApiError`), sementara halaman biasa (non-API) tetap di-redirect ke
`/login` untuk UX. Ditemukan lewat verifikasi manual di browser
(navigasi langsung ke `/api/v1/master-data/academic-years` tanpa sesi),
bukan lewat code review — pengingat kenapa verifikasi end-to-end tetap
penting meski sudah lint+typecheck+test hijau.

**D31. Field foreign-key lintas-entity di UI admin minimal PHASE 4
(`classes.academicYearId`, `santri.classId`) berupa input teks UUID
biasa, BUKAN dropdown yang di-fetch dari entity terkait.**
Alasan: membangun cross-entity dropdown fetching untuk setiap FK adalah
kerja UI yang signifikan, dan PHASE 4 memprioritaskan
correctness/testability service+API layer di atas kualitas UX (lihat
urutan prioritas di `docs/architecture.md`). Setiap field bertipe ini
diberi teks bantuan ("Salin dari halaman X"). Peningkatan UX (dropdown,
pencarian) adalah kandidat wajar untuk PHASE 8 (DASHBOARD + REPORT) atau
saat modul terkait benar-benar dipakai end-to-end di PHASE 6.

## PHASE 5 — Financial Engine

**D32. Saldo akun keuangan = SUM murni seluruh baris `financial_ledger`
untuk akun itu — TIDAK ADA lagi baca terpisah dari
`financial_accounts.opening_balance` saat menghitung saldo berjalan.**
Alasan: ini sudah jadi niat desain sejak PHASE 2 (komentar di
`schema.prisma`: "ENDING BALANCE = ... computed by SUMing this table's
signed amount"), sekarang benar-benar diimplementasikan:
`ensureOpeningBalanceEntry` (`services/LedgerService.ts`) meng-insert satu
baris `OPENING_BALANCE` dari `financial_accounts.opening_balance` — sekali
saja, idempoten (cek dulu apakah sudah ada) — sesaat sebelum SUM dihitung.
Ini juga meng-"heal" akun yang dibuat di PHASE 4 sebelum ledger ini ada;
tidak perlu migration data terpisah.

**D33. Isolasi transaksi `Serializable` (bukan default `ReadCommitted`)
dipakai KHUSUS untuk jalur posting pengeluaran langsung
(`ExpenseService.submitAndPost`), dengan retry otomatis (maks 3x) saat
Postgres melempar error konflik serialisasi (`P2034`).**
Alasan: ini jawaban langsung atas skenario test wajib spec section 18 —
dua pengeluaran Rp700rb konkuren terhadap saldo Rp1jt TIDAK boleh
menghasilkan saldo negatif kalau `allow_negative_balance = false`. Pola
"baca saldo lalu insert" naif (`ReadCommitted`) punya race condition
klasik: kedua request bisa membaca saldo Rp1jt yang sama sebelum salah
satu commit, dan keduanya lolos cek. `Serializable` membuat Postgres
sendiri yang mendeteksi write-conflict ini dan membatalkan salah satu
transaksi — `lib/serializable-retry.ts` menangkap pembatalan itu
(`P2034`) dan mencoba ulang, kali ini membaca saldo yang sudah
ter-update. Income tidak memakai isolasi ini (selalu menambah saldo,
tidak ada risiko overdraw untuk dicegah).
**Keterbatasan jujur**: race condition sungguhan hanya bisa diverifikasi
dengan request konkuren ke PostgreSQL nyata — tidak ada di environment
ini (D14). Yang diuji di PHASE 5 (`tests/unit/lib/serializable-retry.test.ts`)
adalah mekanisme retry-nya sendiri (mocked), bukan perilaku konkurensi
Postgres yang sesungguhnya. Test konkurensi nyata menyusul begitu ada
database — dicatat sebagai utang, bukan diklaim selesai.

**D34. `Idempotency-Key` dibaca dari HTTP header (`request.headers.get("Idempotency-Key")`),
bukan field body — dan replay mengembalikan record yang SAMA (200), bukan
error 409 atau duplikat baru.**
Alasan: spec section 17 secara eksplisit menyebut "Idempotency-Key" gaya
header (konvensi Stripe), bukan field data bisnis. Semantik idempotency
yang benar: request kedua dengan key yang sama harus terlihat seperti
request pertama berhasil lagi, bukan gagal — `lib/idempotency.ts`
(`withIdempotency`) mengecek record yang sudah ada dulu (fast path), dan
kalau `create()` tetap race dengan request konkuren identik, unique
constraint DB pada `idempotency_key` yang jadi sumber kebenaran akhir
(P2002 ditangkap → re-fetch pemenang race, bukan dilempar sebagai error
ke pengguna).

**D35. Kode `financial_ledger`, `income_transactions`, `expense_transactions`
yang tadinya memanggil `tx.xxx` Prisma langsung di dalam service
(ditemukan sendiri saat menulis draft pertama `IncomeService`/
`ExpenseService`) difaktorkan ulang ke repository (`FinancialLookupRepository`,
`ApprovalRequestRepository`, tambahan fungsi di `LedgerRepository`)
SEBELUM menulis test.**
Alasan: draft pertama melanggar aturan arsitektur sendiri ("service tidak
pernah panggil Prisma langsung") untuk kode di dalam `prisma.$transaction`,
dengan alasan "`tx` kan bukan `prisma` singleton" — setelah dipikir ulang,
alasan itu tidak cukup kuat: baik `tx` maupun `prisma` sama-sama akses
Prisma langsung, dan campur-aduk pola (sebagian lewat repository, sebagian
raw `tx.xxx`) membuat service jadi lebih sulit di-unit-test (harus
membuat fake `tx` dengan banyak method Prisma) dan lebih sulit dibaca
konsisten. Setelah difaktorkan, setiap service HANYA memanggil fungsi
repository — test bisa mock repository saja, `tx` yang dilewatkan ke
mereka jadi objek placeholder kosong (`{}`) yang tidak pernah benar-benar
dipakai kode uji.

**D36. `services/ReversalService.ts` dibuat sebagai modul terpisah,
membungkus logika "post baris REVERSAL + catat `reversal_transactions`"
yang tadinya disalin-tempel identik di `IncomeService.voidIncome` dan
`ExpenseService.voidExpense`.**
Alasan: sama seperti alasan `masterDataService.ts` generic engine di D25
— dua salinan logika yang identik persis untuk aturan financial-integrity
inti (POSTED → VOIDED → REVERSAL, spec section 10) adalah risiko nyata:
kalau logic reversal perlu diperbaiki nanti, ada 2 tempat yang harus
diingat untuk diubah bersamaan. Status update (`markIncomeVoided` vs
`markExpenseVoided`) dan audit logging TETAP di masing-masing service
(genuinely berbeda per tabel), hanya mekanisme reversal ledger yang
dipakai bersama.

**D37. PHASE 5 secara sengaja TIDAK membangun endpoint approve/reject
untuk `approval_requests` — `ExpenseService.submitExpense` hanya membuat
baris `PENDING_APPROVAL` + `approval_requests` berstatus `PENDING` lalu
berhenti di situ.**
Alasan: daftar phase eksplisit memisahkan `PHASE 5 FINANCIAL ENGINE` dari
`PHASE 7 APPROVAL` — approve/reject bukan "belum sempat", tapi memang
scope PHASE 7. Membangunnya sekarang berarti mendahului fase yang belum
diminta. Konsekuensi yang disadari: pengeluaran yang butuh approval akan
"macet" di `PENDING_APPROVAL` sampai PHASE 7 selesai — ini status yang
valid dan diharapkan, bukan bug.

**D38. Hanya role `BENDAHARA` yang bisa mencatat pemasukan/pengeluaran
dan void — bukan `ADMIN`.**
Alasan: daftar tanggung jawab role di spec section 2 secara eksplisit
memisahkan cakupan Admin (user, master data, settings, audit) dari
Bendahara (pemasukan, pengeluaran, kas/bank, dst) — Admin tidak disebut
mengelola transaksi harian. `GET` (list) tetap terbuka untuk role manapun
yang sudah login (Yayasan perlu memonitor, Admin perlu mengawasi).

## PHASE 6 — Billing + Payment

**D39. Pembayaran santri SELALU memicu `IncomeService.postIncomeWithinTransaction`
di dalam transaksi `PaymentService` sendiri — bukan dua transaksi terpisah
(satu untuk income, satu untuk payment/alokasi).**
Alasan: `services/IncomeService.ts` di-refactor (mengekspos
`postIncomeWithinTransaction`/`voidIncomeWithinTransaction` yang menerima
`tx` dari pemanggil, terpisah dari `recordIncome`/`voidIncome` publik yang
membungkus `$transaction` sendiri) supaya `PaymentService` bisa
menggabungkan posting income + alokasi tagihan + penerbitan kredit
menjadi SATU unit atomik. Kalau salah satu langkah gagal (mis. tagihan
tidak ditemukan), seluruh pembayaran — termasuk efek ledger-nya — ikut
batal, bukan meninggalkan income ter-posting tanpa alokasi yang jelas.

**D40. Alokasi pembayaran ke banyak tagihan sekaligus memakai urutan
`dueDate` paling awal lebih dulu (FIFO by due date), bukan urutan
`billIds` yang dikirim client.**
Alasan: spec section 12 tidak menentukan urutan alokasi secara eksplisit,
tapi "lunasi yang jatuh tempo lebih dulu, dulu" adalah praktik akuntansi
standar dan hasilnya predictable terlepas dari urutan array yang dikirim
client — mencegah client secara tidak sengaja (atau sengaja) mengatur
urutan alokasi demi keuntungan tertentu. Tagihan tanpa `dueDate`
diperlakukan sebagai prioritas terakhir.

**D41. `billIds` pada `POST /api/v1/santri-payments` boleh kosong — jika
kosong, SELURUH jumlah pembayaran langsung menjadi `santri_credits`
(deposit di muka), bukan error validasi.**
Alasan: spec section 12 mendaftar "overpayment/credit balance" sebagai
kapabilitas, dan pembayaran di muka tanpa tagihan spesifik (santri/wali
menitipkan dana untuk tagihan yang akan datang) adalah skenario nyata
yang tidak secara eksplisit dilarang. Memaksa `billIds` wajib diisi
berarti sistem tidak bisa menangani skenario itu sama sekali.

**D42. "Menerapkan kredit ke tagihan baru" (`CreditService.applyCreditToBill`)
TIDAK membuat baris `santri_payments`/`payment_allocations` — hanya
mengubah `santri_bills.amount_paid`/`status` langsung + satu baris
`santri_credits` (`CONSUMED`).**
Alasan: `santri_payments.financial_account_id` wajib diisi (uang tunai
sungguhan masuk ke suatu akun) — memakai kredit yang sudah ada BUKAN
pemasukan uang baru (uang itu sudah tercatat ke ledger saat overpayment
awal terjadi), jadi memaksakannya lewat `SantriPayment` akan
menghasilkan `financialAccountId` palsu/tidak bermakna dan berisiko
menghitung ganda pemasukan di ledger. Skema `santri_credits.consumed_for_bill_id`
(sudah ada sejak PHASE 2) memang dirancang untuk pola ini.

**D43. `santri_credits` diperlakukan sebagai POOL FUNGIBEL per santri
(`SUM` semua baris), BUKAN dilacak per-lot ke pembayaran asalnya —
konsekuensinya, `PaymentService.voidPayment` MENOLAK membatalkan
pembayaran yang kreditnya "sudah mungkin" terpakai, walau tidak bisa
dipastikan baris `CONSUMED` mana yang berasal dari kredit pembayaran
ini secara spesifik.**
Alasan: skema `santri_credits.consumedForBillId` mencatat tagihan mana
yang menghabiskan kredit, TAPI TIDAK mencatat dari `sourcePaymentId` mana
kredit itu berasal (kredit dianggap dana yang fungibel begitu masuk ke
pool santri, bukan "lot" yang dilacak asal-usulnya — cara paling umum
sistem semacam ini bekerja). Konsekuensinya: begitu saldo kredit
keseluruhan santri turun di bawah jumlah yang diterbitkan pembayaran
tertentu, `voidPayment` menolak (throw `ForbiddenError`) alih-alih
menebak apakah kredit yang tersisa "cukup" — pilihan yang aman secara
finansial, walau lebih konservatif daripada yang secara teknis mungkin
diperlukan. Trade-off yang disadari, dicatat di komentar
`services/PaymentService.ts`.

**D44. Kode `tx.paymentAllocation.findMany`, `tx.santriBill.findFirst`,
`tx.santriCredit.aggregate`, `tx.incomeTransaction.findFirst` yang tadinya
dipanggil langsung di draft pertama `PaymentService.voidPayment`
(ditemukan sendiri, pola yang sama seperti D35 PHASE 5) difaktorkan ke
`listAllocationsForPaymentTx`, `findBillByIdTx`, `sumIssuedCreditForPayment`,
`findIncomeByIdTx` SEBELUM menulis test.**
Alasan: sama seperti D35 — konsistensi arsitektur ("service tidak pernah
panggil Prisma langsung", termasuk di dalam `prisma.$transaction`) dan
testability (mock repository, bukan fake Prisma transaction client).
Pola ini sekarang diulang di PHASE 6 tanpa perlu didiskusikan ulang dari
nol — bukti bahwa menuliskannya eksplisit di PHASE 5 benar-benar mencegah
pengulangan kesalahan yang sama.

## PHASE 7 — Approval

**D45. Cek saldo (`allowNegativeBalance`) untuk pengeluaran yang butuh
approval BARU dijalankan saat approve (`ApprovalService.approveExpense`
→ `ExpenseService.postApprovedExpenseWithinTransaction`), BUKAN saat
submit (`ExpenseService.submitForApproval`, PHASE 5).**
Alasan: saat submit, expense belum tentu akan pernah diposting (bisa
ditolak) — mengecek saldo di titik itu tidak berguna dan saldo bisa saja
sudah berubah signifikan di antara submit dan approve (approval kadang
butuh waktu berhari-hari). Titik yang benar secara finansial untuk
mengecek "apakah saldo cukup" adalah TEPAT SEBELUM baris ledger benar-benar
diposting — yaitu saat approve, bukan submit. Isolasi `Serializable` +
retry (D33) dipakai di titik ini juga, persis pola yang sama seperti
`submitAndPost` di PHASE 5.

**D46. `PENDING_APPROVAL → REJECTED` diimplementasikan; `REJECTED → DRAFT`
(edit ulang + resubmit oleh Bendahara) SENGAJA TIDAK dibangun di PHASE 7.**
Alasan: diagram spec section 11 menampilkan 3 node berurutan
(`PENDING_APPROVAL → REJECTED → DRAFT`), tapi tidak ada di mana pun dalam
aplikasi ini kapabilitas "edit transaksi pengeluaran yang sudah dibuat" —
`ExpenseService` hanya punya `submitExpense` (buat baru) dan `voidExpense`
(batalkan yang sudah POSTED), tidak ada `updateExpense`. Membangun
"kembali ke DRAFT lalu resubmit" tanpa kapabilitas edit yang mendasarinya
akan menghasilkan DRAFT yang tidak bisa diapa-apakan (dead end yang lain).
Scope PHASE 7 secara harfiah adalah "APPROVAL", bukan "edit & resubmit
transaksi" — jadi pengeluaran yang ditolak tetap berstatus `REJECTED`
(riwayat lengkap tetap ada, termasuk `reason` di `approval_requests`),
dan kapabilitas edit+resubmit dicatat sebagai keputusan scope yang
disadari, bukan celah yang terlewat. Kandidat alami: PHASE 9/12 kalau
benar-benar dibutuhkan, atau workaround saat ini — Bendahara membuat
transaksi pengeluaran baru dengan jumlah/kategori yang sudah dikoreksi.

**D47. Guard "creator tidak boleh menjadi approver" diterapkan di
APLIKASI (pesan error jelas) MAUPUN di DATABASE (`CHECK` constraint dari
D16, PHASE 2) — dan diterapkan untuk REJECT juga, bukan hanya APPROVE.**
Alasan: spec section 3/11 hanya menyebutkan pembatasan ini untuk
"menyetujui" secara literal, tapi constraint DB-nya
(`decided_by_id <> requested_by_id`) tidak membedakan APPROVED vs
REJECTED — keduanya sama-sama "keputusan" yang dibuat `decided_by_id`.
Menerapkan guard yang sama secara konsisten ke reject mencegah
Bendahara "menolak" pengajuannya sendiri sebagai cara memutar-balik
alur approval (walau secara praktik tidak banyak untungnya, tetap
inkonsisten secara aturan kalau dibiarkan berbeda).

**D48. `markExpensePosted`/`markExpenseRejected`/`markApprovalRequestApproved`/
`markApprovalRequestRejected` menyertakan filter status (`PENDING_APPROVAL`/
`PENDING`) di klausa WHERE update-nya sebagai guard konkurensi — kalau
dua approver berlomba memutuskan approval request yang sama, yang kalah
mendapat `ConflictError` yang jelas, bukan error Prisma mentah atau
(lebih buruk) diam-diam menimpa keputusan yang menang.**
Alasan: berbeda dari race condition saldo (PHASE 5, D33 — butuh isolasi
transaksi `Serializable` penuh karena melibatkan agregasi SUM), race
condition di sini murni "siapa yang update duluan menang" — cukup
diselesaikan dengan WHERE clause yang menyertakan status saat ini (Prisma
melempar P2025 kalau tidak ada baris yang cocok), tanpa perlu isolasi
transaksi yang lebih mahal. Kedua mekanisme concurrency-control dipakai
di tempat yang tepat sesuai jenis race condition-nya, bukan dipukul rata.

## PHASE 8 — Dashboard + Report

**D49. Saldo per akun di dashboard dihitung lewat `getAccountBalance` yang
SAMA PERSIS dipakai PHASE 5 (lazy self-heal `OPENING_BALANCE` + SUM ledger),
dibungkus `Serializable` transaction + retry yang sama — BUKAN rumus baca
saja yang baru.**
Alasan: bootstrap rule 10 ("Jangan duplicate financial calculation").
Alternatif yang dipertimbangkan: rumus read-only terpisah (cek keberadaan
baris `OPENING_BALANCE` + SUM, tanpa menulis apa pun) supaya `GET
/api/v1/dashboard/summary` tidak pernah menyebabkan write — tapi itu berarti
dua tempat berbeda menghitung "saldo akun", dengan risiko keduanya perlahan
berbeda hasil kalau salah satu diubah tanpa yang lain. Konsekuensi yang
disadari: request GET pertama ke dashboard untuk akun yang baru dibuat (dan
belum pernah diposting transaksi apa pun) akan menulis satu baris
`OPENING_BALANCE` — ini idempotent/self-healing by design (lihat komentar di
`services/LedgerService.ts`), bukan bug baru, hanya diperluas ke jalur baca.

**D50. Endpoint export laporan (`GET /api/v1/reports/{financial,billing}/export`)
menulis baris audit `EXPORT` — satu-satunya rute GET di codebase ini yang
punya efek samping tulis di luar dirinya sendiri.**
Alasan: spec section 16 mewajibkan `EXPORT` sebagai salah satu dari 12 aksi
yang wajib diaudit, dan sebuah file download tidak punya verb HTTP
non-idempotent yang masuk akal untuk dipakai (POST untuk "mengunduh" akan
janggal bagi klien manapun, termasuk link `<a href>` biasa di UI). Efek
samping ini sengaja dibatasi HANYA pada insert `audit_logs` (immutable,
insert-only) — tidak pernah menyentuh data domain — jadi tidak melanggar
semantik "GET aman" dalam pengertian yang penting (tidak mengubah state
finansial/bisnis apa pun).

**D51. PDF pakai `pdfkit`, XLSX pakai `exceljs` — bukan Puppeteer/headless
Chrome untuk PDF, atau `xlsx` (SheetJS) untuk spreadsheet.**
Alasan: spec section 7 menyebut "Server-side PDF" dan "XLSX" tanpa mengunci
library. `pdfkit` murni JavaScript (tanpa browser headless, lebih ringan
untuk deployment) dan cukup untuk laporan tabular sederhana PHASE 8.
`exceljs` dipilih atas `xlsx`/SheetJS karena riwayat CVE prototype-pollution
SheetJS yang belum terselesaikan di banyak versi; `exceljs` punya API
streaming/buffer yang jelas dan maintenance lebih aktif. Trade-off yang
disadari (dicatat, bukan diperbaiki paksa): `exceljs` menarik `uuid < 11.1.1`
sebagai dependency transitif, yang punya advisory moderate (GHSA-w5hq-g745-
h8pq, missing buffer bounds check pada `uuid.parse`/`v3`/`v5`/`v6` saat
`buf` argumen disediakan). Kode SIKEP tidak pernah memanggil fungsi `uuid`
tersebut secara langsung maupun meneruskan buffer yang dikontrol pengguna ke
`exceljs`, jadi risiko praktisnya rendah — tapi `npm audit fix --force` yang
akan men-downgrade `exceljs` ke `3.4.0` (breaking change) SENGAJA tidak
dijalankan tanpa persetujuan eksplisit (lihat aturan commit PHASE 1).

**D52. Dashboard (`/dashboard`, `GET /api/v1/dashboard/summary`) dan Laporan
(`/laporan`, `GET /api/v1/reports/*`) bisa diakses role manapun yang login —
tidak dibatasi per-role.**
Alasan: konsisten dengan konvensi GET yang sudah berlaku sejak PHASE 5
("Bendahara beroperasi, Yayasan memonitor, Admin mengawasi" — semua GET
finansial terbuka untuk role manapun yang sudah login; hanya mutasi yang
dibatasi role tertentu). Dashboard dan Laporan murni read-only, jadi tidak
ada alasan untuk memperkenalkan aturan otorisasi baru yang berbeda dari
pola yang sudah mapan.

**D53. Tren bulanan di dashboard (6 bulan terakhir) dan filter tanggal
laporan keuangan pakai batas kalender UTC, bukan batas hari Asia/Jakarta
yang sesungguhnya.**
Alasan: default engineering paling aman untuk PHASE 8 (bootstrap rule 24) —
tidak ada kode lain di codebase ini yang sudah melakukan konversi
timezone-aware untuk batas tanggal (transactionDate disimpan sebagai
timestamptz, dibaca/ditulis apa adanya). Menambahkan konversi Asia/Jakarta
yang benar hanya untuk PHASE 8 akan menciptakan pola baru yang tidak
konsisten dengan sisa aplikasi. Konsekuensi yang disadari: transaksi yang
terjadi larut malam WIB (UTC+7, dekat tengah malam UTC) bisa masuk hitungan
bulan/hari yang bergeser satu hari dibanding kalender Asia/Jakarta yang
sebenarnya. Kandidat perbaikan menyeluruh (timezone-aware date boundaries di
seluruh aplikasi, bukan hanya laporan) — kalau dibutuhkan — adalah scope
PHASE 9 atau PHASE 10, bukan PHASE 8.

## PHASE 9 — Reconciliation + Audit

**D54. Rekonsiliasi TIDAK menambah tabel baru — memakai `financial_periods`
yang sudah ada sejak PHASE 2 (belum pernah dipakai layanan mana pun sampai
sekarang) plus kolom `old_values`/`new_values` (`Json?`) yang sudah ada di
`audit_logs` untuk menyimpan snapshot hasil rekonsiliasi (saldo sistem vs
saldo aktual per akun, selisihnya).**
Alasan: skema 26-tabel di spec section 13 sudah final sejak PHASE 2 —
menambah tabel `bank_reconciliations` baru berarti menyimpang dari daftar
tabel yang eksplisit dikunci spesifikasi tanpa instruksi baru. `audit_logs`
sudah punya kolom JSON yang dirancang persis untuk menyimpan snapshot
seperti ini (dan aksi `CONFIG_CHANGE` sudah ada di 12 audit action tetap,
spec section 16), jadi tidak perlu skema baru sama sekali — hanya
menggunakan yang sudah tersedia dengan cara yang tepat.

**D55. `getAccountBalanceWithRetry` diekstrak ke `services/LedgerService.ts`
sebagai satu implementasi bersama, dipakai baik oleh `DashboardService`
(PHASE 8, direfaktor) maupun `FinancialPeriodService` (PHASE 9) — bukan
masing-masing membungkus `Serializable` transaction + retry sendiri-sendiri.**
Alasan: bootstrap rule 10 ("Jangan duplicate financial calculation") berlaku
juga untuk boilerplate pembungkus transaksi, bukan cuma rumus finansialnya
sendiri — dua implementasi terpisah dari mekanisme retry yang identik
berisiko perlahan berbeda kalau salah satu diubah tanpa yang lain.

**D56. Penutupan periode keuangan SATU ARAH — `OPEN → CLOSED`, tidak ada
`CLOSED → OPEN` (reopen) di V1.**
Alasan: konsisten dengan filosofi transaction-immutability (spec section 10) yang sudah diterapkan ke transaksi individual, diperluas ke level
periode — kesalahan yang ditemukan setelah periode ditutup dikoreksi lewat
REVERSAL pada transaksi spesifiknya (yang otomatis jatuh ke periode
berjalan yang masih terbuka), bukan dengan membuka kembali seluruh periode
yang sudah direkonsiliasi. Membangun alur reopen (siapa yang boleh, apakah
butuh approval, bagaimana efeknya ke rekonsiliasi yang sudah tercatat)
adalah scope tambahan yang tidak diminta spesifikasi — didokumentasikan
sebagai keputusan sadar, bukan celah yang terlewat.

**D57. Guard `assertPeriodOpenForDate` (menolak `transactionDate` yang
jatuh di periode yang sudah `CLOSED`) dipasang HANYA di titik masuk
pembuatan pemasukan/pengeluaran baru — `IncomeService.postIncomeWithinTransaction`
(mencakup pencatatan pemasukan langsung MAUPUN `PaymentService` yang
memakai primitive yang sama) dan `ExpenseService.submitAndPost` +
`submitForApproval` — TIDAK dipasang di jalur void/reversal.**
Alasan: inti dari "menutup buku" adalah mencegah entri BARU dibuat dengan
tanggal mundur ke periode yang sudah direkonsiliasi — itu satu-satunya hal
yang benar-benar merusak validitas rekonsiliasi yang sudah dilakukan.
Koreksi atas transaksi lama (void → reversal) SENGAJA tetap diizinkan
kapan pun, karena baris REVERSAL selalu dicatat dengan tanggal hari ini
(masuk ke periode berjalan yang terbuka), bukan tanggal transaksi asli —
praktik akuntansi standar, bukan celah keamanan. Pemeriksaan diletakkan di
fungsi inti (`postIncomeWithinTransaction`, bukan `recordIncome` saja) agar
otomatis melindungi SEMUA pemanggil termasuk `PaymentService`, tanpa perlu
mengulang guard yang sama di setiap service pemanggil.

**D58. Pembuatan/penutupan periode keuangan dibatasi role `BENDAHARA`
(spec section 2: "Kas & Bank"/"Rekonsiliasi" adalah tanggung jawab
eksplisit Bendahara). Melihat audit log dibatasi role `ADMIN` dan
`YAYASAN` (spec section 2: Admin mengelola "audit", Yayasan punya
"audit view" eksplisit — daftar tanggung jawab Bendahara tidak
menyebutkan audit sama sekali).**
Alasan: mengikuti persis daftar tanggung jawab per-role di spesifikasi,
bukan menerapkan pola GET-terbuka-untuk-semua-role yang dipakai modul
finansial lain (PHASE 5-8) — modul ini dua-duanya eksplisit disebut milik
role tertentu di spesifikasi, beda dari modul sebelumnya yang tidak
menyebut pembatasan GET per-role.

**D59. Pembuatan periode baru menolak rentang tanggal yang bertabrakan
(overlap) dengan periode lain yang sudah ada di sekolah yang sama.**
Alasan: sebuah tanggal transaksi idealnya masuk ke TEPAT SATU periode agar
rekonsiliasi bermakna — periode yang saling tumpang tindih akan membuat
`assertPeriodOpenForDate` (D57) berperilaku ambigu (tanggal yang sama
tercakup oleh satu periode terbuka dan satu periode tertutup sekaligus).
Pengecekan sederhana lewat query rentang tanggal, bukan constraint
database baru (skema sudah dikunci sejak PHASE 2, D54).

**D60. Baris `financial_ledger` yang baru TIDAK di-stamp dengan
`financialPeriodId` (kolom itu tetap `null`, walau relasinya sudah ada di
skema sejak PHASE 2).**
Alasan: query "ledger entries dalam periode X" tetap bisa dilakukan lewat
rentang tanggal (`financial_periods.startDate`/`endDate`) tanpa FK
tersebut — menstempel FK ini butuh mengubah SETIAP jalur posting ledger
(Income/Expense/Payment/Approval, PHASE 5-7) untuk mencari periode yang
cocok dan menyertakannya, sebuah perubahan lintas-modul yang lebih besar
dari yang dibutuhkan fungsionalitas PHASE 9. Dicatat sebagai keterbatasan
sadar, kandidat penyempurnaan performa/pelaporan di phase mendatang kalau
benar-benar dibutuhkan (mis. laporan ledger per periode dalam skala besar).

## PHASE 10 — Security Hardening

**D61. Content-Security-Policy statis (tanpa nonce per-request), bukan
CSP berbasis nonce (`'nonce-...' 'strict-dynamic'`) yang lebih ketat.**
Alasan: dokumentasi resmi Next.js (`node_modules/next/dist/docs/01-app/
02-guides/content-security-policy.md`) menyatakan CSP berbasis nonce
MEWAJIBKAN setiap halaman dirender dinamis (`await connection()` atau
setara) — Static Rendering/ISR tidak bisa dipakai sama sekali, karena
nonce dibuat per-request sementara halaman statis dibuat sekali saat
build. Hampir semua halaman SIKEP saat ini ter-render statis (`○ Static`
di output `next build`, lihat `docs/step8/00-progress.md`/
`docs/step9/00-progress.md`) — memaksa semuanya jadi dinamis demi CSP
yang lebih ketat adalah trade-off performa (prioritas #9) yang besar
untuk manfaat keamanan yang marginal DI APLIKASI INI SECARA SPESIFIK:
audit `grep` menyeluruh (D63) mengonfirmasi TIDAK ADA satu pun
`dangerouslySetInnerHTML` atau HTML dari input pengguna yang dirender
mentah di seluruh codebase — permukaan serangan injeksi skrip yang
sebenarnya coba dicegah nonce-based CSP sudah nyaris nol lewat React
auto-escaping saja. CSP statis (`lib/security-headers.ts`) tetap
memberikan proteksi nyata terhadap clickjacking (`frame-ancestors 'none'`),
base-tag injection (`base-uri 'self'`), form-hijacking (`form-action
'self'`), dan plugin/object exploits (`object-src 'none'`) tanpa
mengubah cara rendering apa pun. Kandidat upgrade ke nonce-based CSP
dicatat sebagai opsi PHASE 12 (PRODUCTION) kalau kebutuhan compliance
mengharuskannya nanti.

**D62. Temuan `npm audit` (uuid moderate via `exceljs`, deepmerge-ts/mysql2
high via dev-dependency `prisma` CLI) — SAMA seperti yang didokumentasikan
di D51 (PHASE 8) — diverifikasi ULANG di PHASE 10 dan TIDAK diperbaiki
paksa.**
Alasan: `npm audit fix --force` akan men-downgrade `prisma`/`exceljs` ke
versi breaking change tanpa persetujuan eksplisit (dilarang oleh aturan
commit PHASE 1). `deepmerge-ts`/`mysql2` adalah dependency transitif dari
`prisma` CLI (dev-only, tidak pernah masuk ke bundle production maupun
dijalankan saat runtime aplikasi) — tidak berisiko terhadap pengguna
akhir. `uuid` dari `exceljs` tetap tidak tersentuh oleh input pengguna di
kode SIKEP manapun. Re-verifikasi PHASE 10 memastikan tidak ada temuan
BARU yang muncul sejak PHASE 8 — hasilnya identik.

**D63. Audit keamanan PHASE 10 (CSRF, RBAC/autentikasi, IDOR, XSS surface)
dilakukan lewat `grep` sistematis terhadap kode yang SUDAH ADA, BUKAN
menulis test/scanner otomatis baru untuk memverifikasinya berkelanjutan.**
Alasan: pola-pola ini (setiap route mutating memanggil `requireCsrf`,
setiap route memanggil `requireSession`/`requireRole`, setiap query
by-id menyertakan `schoolId`) sudah konsisten diterapkan sejak PHASE 3-4
lewat disiplin arsitektur (layering, D24) — bukan sesuatu yang baru
dibangun PHASE 10. Membangun linter/scanner kustom untuk menegakkan pola
ini secara otomatis ke depannya adalah kandidat PHASE 11 (TESTING) kalau
dianggap perlu, bukan scope "hardening" yang menemukan & memperbaiki
celah nyata — audit PHASE 10 tidak menemukan satu pun celah CSRF/RBAC/
IDOR, hasilnya murni dokumentasi bukti (`docs/architecture.md`
"Audit Keamanan PHASE 10").

**D64. Rate limiting TETAP hanya di `POST /api/v1/auth/login` (sejak
PHASE 3) — tidak diperluas ke endpoint lain di PHASE 10.**
Alasan: login adalah satu-satunya endpoint yang menerima kredensial dan
bisa di-brute-force oleh pihak yang BELUM terautentikasi. Setiap endpoint
lain sudah dilindungi `requireSession`/`requireRole` (harus punya sesi
valid dulu) DAN `requireCsrf` (harus punya cookie CSRF dari sesi yang
sama) — bukan target brute-force credential-guessing yang relevan untuk
rate limiter IP-based. Memperluas rate limiting ke semua endpoint
finansial akan menambah kompleksitas (state in-memory per key, D19) tanpa
mengurangi risiko nyata yang belum tertangani RBAC+CSRF+session.

**D65. Header `Strict-Transport-Security` hanya dikirim saat
`NODE_ENV !== "development"` (bukan berdasarkan deteksi HTTPS per-request
yang sesungguhnya).**
Alasan: `next.config.ts` `headers()` adalah konfigurasi statis yang
dievaluasi saat build/boot, tidak punya akses ke skema request individual
(`http`/`https`) — deteksi protokol per-request butuh middleware/proxy
(`proxy.ts`), kompleksitas tambahan yang tidak sepadan untuk PHASE 10
karena asumsi standarnya sudah aman: deployment production (PHASE 12)
HARUS selalu di belakang HTTPS/TLS-terminating load balancer, jadi
`NODE_ENV=production` adalah proxy yang cukup akurat untuk "sedang
melayani lewat HTTPS" di seluruh siklus hidup aplikasi ini.

## PHASE 11 — Testing

**D66. Tidak ada PostgreSQL nyata di lingkungan pengembangan ini (sama
seperti dicatat sejak PHASE 2's migration) — "Integration Test",
"Concurrency Test", dan "Idempotency Test" (spec section 18) SEMUANYA
diimplementasikan sebagai test yang memanggil SERVICE FUNCTION ASLI
(`ExpenseService.submitExpense`, `ApprovalService.approveExpense`, dst,
BUKAN dites ulang lewat reimplementasi logika) dengan repository/prisma
di-mock secara STATEFUL (variabel bersama yang berubah antar
pemanggilan) untuk mensimulasikan efek concurrent/retry — bukan
dijalankan terhadap Postgres sungguhan.**
Alasan: ini adalah batasan lingkungan yang sudah berulang kali dicatat
(PHASE 2 migration, PHASE 8 "Preview browser" tanpa login sungguhan) —
bukan kelonggaran baru yang diperkenalkan PHASE 11. Test-test ini
membuktikan LOGIKA bisnis benar (balance re-read tiap percobaan,
WHERE-clause guard mencegah race, `withIdempotency` mencegah double-post
saat racing insert kena unique constraint) — yang merupakan tanggung
jawab KODE kami. Isolasi transaksi `Serializable` PostgreSQL itu sendiri
(yang benar-benar mencegah dua transaksi commit secara konkuren) adalah
fitur database eksternal yang sudah terverifikasi luas oleh PostgreSQL
sendiri — bukan sesuatu yang perlu (atau bisa) dibuktikan ulang oleh test
suite aplikasi ini tanpa instance Postgres sungguhan. Lihat
`tests/integration/financial-integrity.test.ts` (skenario tepat spec
section 18: saldo Rp1.000.000, dua expense Rp700.000, tidak boleh saldo
negatif) dan `tests/integration/concurrency.test.ts`.

**D67. `tests/integration/security.test.ts` menguji ROUTE HANDLER ASLI
(`GET`/`POST` yang diimpor langsung dari `app/api/v1/**/route.ts`) lewat
`NextRequest` sungguhan — lapisan yang belum pernah diuji otomatis
sebelumnya (PHASE 1-10 semuanya berhenti di lapisan service, verifikasi
route hanya lewat `curl`/browser manual tiap akhir phase).**
Alasan: `lib/rbac.ts` (`requireSession`/`requireRole`) di-mock supaya
setiap skenario auth bisa dipaksa (mekanisme JWT-nya sendiri sudah diuji
`tests/unit/lib/auth/session.test.ts`), tapi `requireCsrf`/`verifyCsrfToken`
SENGAJA TIDAK di-mock — hanya titik baca cookie-nya
(`lib/auth/cookies.ts` `getCsrfCookieValue`) yang di-mock, karena cookie
sungguhan butuh `next/headers` yang terikat request-scope Next.js dan
tidak tersedia di Vitest. Perbandingan timing-safe CSRF yang sesungguhnya
tetap berjalan nyata terhadap header request yang benar-benar dikirim di
test.

**D68. `@vitest/coverage-v8` ditambahkan (`npm run test:coverage`),
dipin ke versi PERSIS SAMA dengan `vitest` (`4.1.11`) — bukan `*`/range
terbuka.**
Alasan: `npm install -D @vitest/coverage-v8` tanpa pin awalnya menarik
`5.0.1` (tidak cocok dengan `vitest@4.1.11` yang sudah terpasang) dan
memicu bug internal npm arborist (`Cannot read properties of null
(reading 'children')`) saat membangun dependency tree — dipin ke versi
yang sama-persis menyelesaikannya dan juga mencegah version-skew
provider/runner di masa depan (pola yang sama dengan D2 PHASE 1 untuk
`prisma`/`@prisma/client`).

**D69. Coverage report (`vitest.config.ts` `coverage.exclude`) SENGAJA
mengecualikan `app/**` dan `components/**` (UI), bukan hanya file
konfigurasi.**
Alasan: seluruh test suite berjalan di `environment: "node"` (bukan
`jsdom`/browser) — tidak ada dan tidak pernah ada rendering test untuk
komponen React di proyek ini (PHASE 1-10 memverifikasi UI lewat browser
pane manual tiap akhir phase, bukan automated component test).
Memasukkan `app/**`/`components/**` ke laporan coverage hanya akan
menampilkan 0% yang menyesatkan (bukan sinyal kualitas kode yang rendah)
untuk kode yang memang butuh alat verifikasi berbeda (E2E/browser test),
bukan test Node yang dipakai di sini.

## PHASE 12 — Production

**D70. `GET /api/v1/health` SENGAJA TIDAK memakai envelope standar
`{success,data,message}`/`{success,error}` (`lib/api-response.ts`) yang
dipakai SEMUA endpoint lain — responsnya `{status,checks}` polos dengan
kode HTTP 200/503.**
Alasan: health check dikonsumsi oleh tooling infrastruktur (load
balancer, process manager, uptime monitor) yang membaca kode status HTTP
dan mengharapkan bentuk JSON generik `{"status":"ok"}` — bukan klien
bisnis aplikasi yang memahami kontrak `{success,data,message}` milik
SIKEP. Memaksakan envelope bisnis ke endpoint infrastruktur murni
menambah friksi integrasi tanpa manfaat.

**D71. Health check memverifikasi konektivitas database (`SELECT 1`)
lewat fungsi murni `lib/health.ts` `checkHealth()` — TIDAK memverifikasi
hal lain (mis. disk space, memory, dependency eksternal).**
Alasan: satu-satunya dependency eksternal SIKEP yang benar-benar bisa
membuat aplikasi tidak berfungsi adalah PostgreSQL (tidak ada Redis,
S3, atau layanan pihak ketiga lain yang dipakai runtime — S3 untuk
Bukti Transaksi belum diimplementasikan, lihat catatan PHASE 10).
Memeriksa hal lain akan memeriksa kesehatan MESIN (di luar tanggung
jawab kode aplikasi), bukan kesehatan APLIKASI.

**D72. `app/error.tsx`/`app/global-error.tsx` (PHASE 12) memakai
`console.error`, BUKAN `lib/logger.ts` (Pino) yang dipakai di semua
kode server lainnya.**
Alasan: keduanya adalah React Error Boundary — wajib Client Component
(`"use client"`, ditegaskan dokumentasi Next.js) yang juga jalan di
BROWSER, bukan cuma server. Pino bergantung pada modul Node murni
(`fs`, `worker_threads`) yang tidak ada di browser; mengimpornya ke
komponen client akan gagal bundling atau membengkakkan bundle client
secara signifikan. `console.error` adalah pola resmi yang dipakai
dokumentasi Next.js sendiri untuk `error.tsx`.

**D73. `error.tsx`/`global-error.tsx` TIDAK PERNAH menampilkan
`error.message` mentah ke pengguna — selalu pesan generik Bahasa
Indonesia, hanya `error.digest` (hash, bukan detail) yang ditampilkan.**
Alasan: konsisten dengan prinsip "jangan bocorkan internal" (spec
section 15) yang sudah diterapkan `handleApiError` (`lib/api-response.ts`)
sejak PHASE 1 — Next.js sendiri sudah menyaring `error.message` untuk
error dari Server Component di production, tapi error dari Client
Component tetap membawa pesan aslinya (didokumentasikan resmi oleh
Next.js) — menampilkan pesan generik tetap secara manual menutup celah
itu, tidak bergantung pada perilaku default Next.js yang bisa berubah.

**D74. Rentang versi `retry` (bukan `reset`) dipakai sebagai nama prop
`error.tsx`/`global-error.tsx`, mengikuti dokumentasi lokal
`node_modules/next/dist/docs/.../error.md` untuk Next.js 16.3.5 yang
terpasang (`retry` stabil sejak v16.3.0), BUKAN nama `reset` yang lebih
umum dikenal dari versi Next.js yang lebih lama.**
Alasan: `AGENTS.md` proyek ini (di-generate `next dev`) memperingatkan
versi Next.js ini punya breaking change dari pengetahuan umum,
mewajibkan baca dokumentasi lokal sebelum menulis kode — verifikasi
langsung ke `node_modules/next/dist/docs/` inilah yang mengungkap
pergantian nama prop ini.

## Gap Fill (di luar 12 phase resmi) — Bukti Transaksi: Object Storage + Signed URL

**D75. "Bukti Transaksi" (spec section 6/15, gap yang dicatat sejak PHASE
10 — lihat `docs/step10/00-progress.md`) diimplementasikan dengan
penyimpanan disk lokal PRIVAT (`lib/storage/attachment-storage.ts`, di
luar `public/`) di belakang abstraksi yang sama dengan yang dipakai
object storage S3-compatible, BUKAN integrasi S3/AWS SDK sungguhan.**
Alasan: lingkungan pengembangan ini tidak memiliki kredensial cloud
storage nyata untuk diverifikasi ujung-ke-ujung (prinsip yang sama
dengan D71 — SIKEP sengaja tidak punya dependency S3 di runtime).
Menulis integrasi AWS SDK yang tidak pernah benar-benar dites terhadap
bucket sungguhan akan melanggar disiplin "verifikasi nyata, bukan
diklaim" yang dipegang sejak PHASE 12. Desainnya tetap S3-ready: kunci
penyimpanan (`storageKey`) 100% dibuat di server (schoolId/entityType
UUID+enum tervalidasi + UUID acak baru) — TIDAK PERNAH memuat nama file
asli dari pengguna — sehingga path traversal tertutup by construction,
bukan oleh sanitasi, dan pengait S3 sungguhan bisa menggantikan
`lib/storage/attachment-storage.ts` tanpa mengubah pemanggilnya
(`services/AttachmentService.ts`).

**D76. "Signed URL" diimplementasikan sebagai token HMAC-SHA256 lokal
berumur pendek (5 menit, `lib/attachments/download-token.ts`), diturunkan
dari `AUTH_SECRET` dengan pemisahan kunci (label berbeda dari
penandatanganan JWT sesi, `lib/auth/session.ts`) — BUKAN kredensial
bearer yang berdiri sendiri: `GET /api/v1/attachments/[id]/download`
tetap mewajibkan sesi valid + tenant match di atas token yang valid.**
Alasan: prinsip inti `lib/rbac.ts` ("setiap route memvalidasi ulang
otorisasinya sendiri", lihat komentarnya) berlaku juga di sini — presigned
URL S3 asli biasanya adalah bearer link anonim, tapi itu tidak cocok
untuk bukti transaksi finansial yang selalu berada di bawah RBAC/tenant
isolation SIKEP. Nilai nyata token ini: membatasi jendela waktu satu
tautan lampiran tetap valid (5 menit) secara independen dari umur sesi
(8 jam) — bukan sekadar "session cookie yang kebetulan melindungi rute
ini". Alur: `GET .../download-url` (baca murni, tanpa side effect,
tidak perlu CSRF) menerbitkan token, `GET .../download` memvalidasinya
lalu mencatat audit `EXPORT` (pola yang sama dengan D50 — GET dengan
audit write, dibatasi hanya `audit_logs`).

**D77. `AuditAction.CREATE` dipakai untuk upload lampiran dan
`AuditAction.EXPORT` untuk download lampiran — TIDAK menambah nilai
enum baru (mis. `UPLOAD`/`DOWNLOAD`) ke `AuditAction`.**
Alasan: komentar `prisma/schema.prisma` di atas `enum AuditAction`
eksplisit — "Per spec section 16 — exact list, do not extend without a
spec change." `EXPORT` sudah dipakai persis untuk pola "mengeluarkan
byte data dari sistem" oleh `app/api/v1/reports/*/export/route.ts`
(laporan PDF/XLSX) — mengunduh lampiran adalah kasus yang sama secara
semantik, jadi memakai ulang nilai yang sudah ada lebih tepat daripada
memperluas daftar yang secara eksplisit dikunci.

**D78. Field FK `transaction_attachments` yang bisa menerima lampiran
dibatasi ke `INCOME_TRANSACTION`/`EXPENSE_TRANSACTION`/`SANTRI_PAYMENT`
(`ATTACHABLE_ENTITY_TYPES`, `lib/validation/attachment.ts`) — bukan
seluruh `FinancialEntityType`.**
Alasan: `OPENING_BALANCE` adalah anggota `FinancialEntityType` (dipakai
bersama oleh `approval_requests`/`reversal_transactions`) tapi
`transaction_attachments` (D17) hanya punya tiga kolom FK nullable
bertipe — tidak ada `openingBalanceId`. Memvalidasi `entityType` upload
terhadap daftar sempit ini mencegah baris lampiran yang FK-nya tidak
akan pernah terisi (`entityForeignKeys`,
`repositories/AttachmentRepository.ts`, memakai `switch` exhaustive atas
tipe sempit ini, bukan `default: throw` atas enum penuh).

**D79. Batas ukuran file (`ATTACHMENT_MAX_FILE_SIZE_BYTES`, default 10
MB) dan direktori penyimpanan (`ATTACHMENT_STORAGE_DIR`) dibuat
konfigurabel lewat `lib/env.ts`, tapi daftar tipe MIME yang diizinkan
(`ATTACHMENT_ALLOWED_MIME_TYPES` — JPEG/PNG/WebP/PDF) di-hardcode di
`lib/validation/attachment.ts`, TIDAK lewat env.**
Alasan: ukuran/lokasi disk adalah keputusan operasional yang wajar
berbeda per deployment (mengikuti pola `DATABASE_URL`/`LOG_LEVEL`),
sedangkan tipe file yang diterima adalah keputusan keamanan/bisnis inti
(mencegah upload executable/script berkedok "bukti transaksi") — sama
seperti `ROLE_CODES` (`constants/roles.ts`) dan `AuditAction`, sengaja
dikunci di kode, bukan di environment, supaya tidak bisa dilonggarkan
diam-diam lewat konfigurasi deployment.

**D80. `next.config.ts`'s Turbopack build memperingatkan "Dynamic
filesystem access causes tracing of the whole project" untuk
`path.resolve(process.cwd(), env.ATTACHMENT_STORAGE_DIR)` — diredam
dengan komentar `/* turbopackIgnore: true */`, BUKAN dihilangkan dengan
membuat direktori jadi statis.**
Alasan: `ATTACHMENT_STORAGE_DIR` sengaja env-driven (D79) supaya ops
bisa memindah lokasi disk tanpa ubah kode — Turbopack tidak bisa
membuktikan itu secara statis, sehingga tanpa komentar ini seluruh
project (termasuk `public/`) ikut ter-trace dan diikutkan ke server
bundle (lihat `docs/deployment.md`). Trade-off yang diterima: mengubah
env var ini butuh redeploy, sama seperti nilai `lib/env.ts` lainnya —
diverifikasi `npm run build` menghasilkan 0 warning setelah perbaikan
ini.
