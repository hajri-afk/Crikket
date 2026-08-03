# Crikket — Requirements

Dokumen kebutuhan untuk menjalankan, mengembangkan, dan men-deploy Crikket.

---

## 1. Ringkasan Produk

Crikket adalah platform **bug reporting & session capture**. User merekam aksi di browser (screenshot, video, console log, network, replay events) lewat **browser extension**, lalu artefak diunggah dan dikelola di **dashboard web**. Backend menyediakan API auth, oRPC endpoints, dan presigned upload untuk object storage.

Komponen utama:

- **apps/server** — Hono API (Better Auth, oRPC, presign upload)
- **apps/web** — Next.js dashboard (manage bug reports, organisasi, billing)
- **apps/docs** — Fumadocs (dokumentasi publik)
- **apps/extension** — WXT browser extension (Chrome/Firefox)
- **packages/** — `api`, `auth`, `billing`, `bug-reports`, `capture-core`, `db`, `env`, `shared`, `ui`
- **sdks/** — SDK capture publik

---

## 2. System Requirements

### 2.1 Hardware (dev)

| Resource | Minimum | Recommended |
| --- | --- | --- |
| CPU | 4 core | 8 core |
| RAM | 8 GB | 16 GB |
| Disk free | 10 GB | 20 GB+ |
| OS | macOS 13+, Linux x64/arm64, Windows 11 (WSL2) | macOS / Linux |

### 2.2 Software

| Tool | Versi minimum | Wajib | Catatan |
| --- | --- | --- | --- |
| Bun | 1.3.5 | ✅ | Package manager + runtime |
| Docker | 24+ | ✅ | Postgres + MinIO container |
| Git | 2.40+ | ✅ | — |
| Node.js | 20 LTS | optional | Untuk tooling tambahan |
| Chrome / Chromium | terbaru | ✅ | Load extension unpacked |
| Firefox | 115+ | optional | `bun run --filter extension build:firefox` |

### 2.3 Network / Port

| Port | Service | Wajib |
| --- | --- | --- |
| 3000 | server (Hono) | ✅ |
| 3001 | web (Next.js) | ✅ |
| 4000 | docs (Next.js) | optional |
| 5555 | extension dev (WXT) | dev only |
| 5432 atau 5433 | Postgres | ✅ |
| 9000 | MinIO S3 API | ✅ (atau S3 cloud) |
| 9001 | MinIO Console | optional |

---

## 3. Service Dependencies

### 3.1 Wajib (core)

- **PostgreSQL 17+** (Docker `postgres:17-alpine` direkomendasikan; Supabase/Neon/RDS untuk prod).
- **Object Storage S3-compatible**: MinIO (lokal) / AWS S3 / Cloudflare R2.

### 3.2 Opsional

| Service | Fitur yang dipakai | Wajib bila |
| --- | --- | --- |
| **Resend** | Email OTP, verifikasi, undangan organisasi | Mengaktifkan login OTP / verifikasi email |
| **Upstash Redis** | Rate limit, replay-protect submit token | Production / public exposure |
| **Cloudflare Turnstile** | Anti-bot pada submit capture | Public capture tanpa auth |
| **Polar.sh** | Billing / paid plans | `ENABLE_PAYMENTS=true` |
| **Google OAuth** | Social login | Mengaktifkan tombol Google |
| **Caddy** | Reverse proxy + auto HTTPS | Self-host production |

---

## 4. Functional Requirements

### 4.1 Authentication & Account

- Email + password sign up / sign in (Better Auth).
- Email OTP & email verification (via Resend).
- Optional Google OAuth.
- Session cookie (14 hari, refresh tiap 1 hari, cookie cache 1 jam).
- Domain restriction via `ALLOWED_SIGNUP_DOMAINS` (`*` = bebas).
- Admin plugin & organization plugin (multi-tenant + invitation flow).

### 4.2 Organization & Membership

- Buat organisasi, undang anggota via email.
- Role-based: owner / admin / member.
- Limit anggota mengikuti entitlement billing (kalau payments aktif).

### 4.3 Bug Report Capture

- Extension merekam: screenshot, video (display recording), console log, network, debugger events, form input.
- Artefak diunggah via **presigned PUT** ke S3-compatible storage.
- Submit token (HMAC) opsional dengan replay-protect (Upstash Redis).
- Rate limit per IP/route (di-enforce DB atau Redis).

### 4.4 Dashboard Web

- List & detail bug reports.
- Pemutar replay session.
- Manajemen anggota organisasi.
- Settings: profil, organisasi, billing portal.
- Onboarding flow (post sign-up).
- Section "Install Without Web Store" untuk panduan extension.

### 4.5 Billing (opsional)

- Integrasi Polar.sh (checkout + customer portal + webhook).
- Produk: pro, pro-yearly, studio, studio-yearly.
- Customer dibuat otomatis saat sign up bila `ENABLE_PAYMENTS=true`.
- Webhook memvalidasi signature & memproses entitlement.

### 4.6 Documentation Site

- Fumadocs (MDX) di `apps/docs`.
- Halaman: getting started, extension install, comparison, dll.

---

## 5. Non-Functional Requirements

| Aspek | Target |
| --- | --- |
| **Performance** | API p95 < 300 ms (lokal); dashboard FCP < 2 s |
| **Reliability** | Server boot < 5 s; DB migration idempoten |
| **Security** | HTTPS-only di prod; cookies `Secure+HttpOnly+SameSite=None`; presigned URL expiry pendek; secret env tidak di-commit |
| **Scalability** | Stateless API (sticky session via cookie); Postgres pooling; storage S3 horizontal |
| **Observability** | Log terstruktur (Hono logger); error capture via PostHog/Sentry (opsional) |
| **Compliance** | GDPR-ready: hapus user → cleanup artifact (job di `packages/bug-reports`) |
| **Accessibility** | UI shadcn / Radix base; kontras WCAG AA |
| **Browser support** | Chrome ≥ 120, Edge ≥ 120, Firefox ≥ 115 (extension MV3) |

---

## 6. Environment Variables

### 6.1 Server (`apps/server/.env`)

| Variable | Required | Default / Contoh | Keterangan |
| --- | --- | --- | --- |
| `NODE_ENV` | ✅ | `development` | `development` \| `production` |
| `DATABASE_URL` | ✅ | `postgresql://postgres:postgres@localhost:5433/crikket` | Postgres connection |
| `CORS_ORIGINS` | ✅ | `http://localhost:3001` | Comma-delimited |
| `ALLOWED_SIGNUP_DOMAINS` | optional | `*` | Comma-delimited domain list |
| `BETTER_AUTH_SECRET` | ✅ | random 32-byte base64url | `bun run generate:secret` |
| `BETTER_AUTH_URL` | ✅ | `http://localhost:3000` | Base URL server |
| `BETTER_AUTH_COOKIE_DOMAIN` | optional | — | Untuk subdomain sharing |
| `RESEND_API_KEY` | optional | — | Wajib untuk email OTP |
| `RESEND_FROM_EMAIL` | conditional | `noreply@example.com` | Wajib jika Resend aktif |
| `GOOGLE_CLIENT_ID` / `_SECRET` | optional | — | OAuth Google |
| `ENABLE_PAYMENTS` | ✅ | `false` (dev) | `true` aktifkan Polar |
| `POLAR_ACCESS_TOKEN` | conditional | — | Wajib bila payments on |
| `POLAR_WEBHOOK_SECRET` | conditional | — | Wajib bila payments on |
| `POLAR_SUCCESS_URL` | conditional | `http://localhost:3001/success?checkout_id={CHECKOUT_ID}` | — |
| `POLAR_PRO_PRODUCT_ID` | conditional | — | Per produk |
| `POLAR_PRO_YEARLY_PRODUCT_ID` | conditional | — | — |
| `POLAR_STUDIO_PRODUCT_ID` | conditional | — | — |
| `POLAR_STUDIO_YEARLY_PRODUCT_ID` | conditional | — | — |
| `STORAGE_BUCKET` | ✅ | `crikket-development` | Bucket name |
| `STORAGE_ACCESS_KEY_ID` | ✅ | `minioadmin` | — |
| `STORAGE_SECRET_ACCESS_KEY` | ✅ | `minioadmin123` | — |
| `STORAGE_REGION` | ✅ | `us-east-1` | — |
| `STORAGE_ENDPOINT` | conditional | `http://localhost:9000` | Wajib untuk MinIO/R2 |
| `STORAGE_ADDRESSING_STYLE` | optional | `path` (MinIO) / `auto` (S3) | `path` \| `virtual` \| `auto` |
| `STORAGE_PUBLIC_URL` | optional | — | Hindari signed URL |
| `UPSTASH_REDIS_REST_URL` | optional | — | Rate limit + token replay |
| `UPSTASH_REDIS_REST_TOKEN` | optional | — | — |
| `CAPTURE_SUBMIT_TOKEN_SECRET` | optional | — | Aktifkan signed submit token |
| `TURNSTILE_SITE_KEY` | optional | — | Anti-bot |
| `TURNSTILE_SECRET_KEY` | optional | — | — |

### 6.2 Web (`apps/web/.env`)

| Variable | Required | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_SERVER_URL` | ✅ | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | ✅ | `http://localhost:3001` |
| `NEXT_PUBLIC_DOCS_URL` | optional | `http://localhost:4000/docs` |
| `NEXT_PUBLIC_POSTHOG_KEY` | optional | — |
| `NEXT_PUBLIC_POSTHOG_HOST` | optional | — |

### 6.3 Extension (`apps/extension/.env`)

| Variable | Required | Default |
| --- | --- | --- |
| `VITE_APP_URL` | ✅ | `http://localhost:3001` |
| `VITE_SERVER_URL` | ✅ | `http://localhost:3000` |

---

## 7. Data Storage

### 7.1 Database (Postgres)

- Schema didefinisikan di `packages/db/src/schema/*` (Drizzle ORM).
- Migrasi: `bun run db:generate` + `bun run db:migrate`, atau push langsung `bun run db:push`.
- Tabel utama: `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, `bug_report`, `bug_report_artifact`, `rate_limit`, dll.

### 7.2 Object Storage

- Bucket tunggal (default `crikket-development`).
- Path: `bug-reports/<orgId>/<reportId>/<artifactId>.<ext>`.
- Lifecycle cleanup: dijadwalkan via background job di `packages/bug-reports`.
- CORS untuk MinIO/S3 perlu mengizinkan `PUT` dari `http://localhost:3001` dan origin extension.

---

## 8. Security Requirements

- Semua secret disimpan di `.env`, **bukan** di repo (`.gitignore` melindungi).
- `BETTER_AUTH_SECRET` ≥ 32 byte, di-rotate periodik.
- Production: `useSecureCookies: true`, `sameSite: none`, HTTPS wajib.
- Rate limit aktif untuk sign-in/up dan email OTP (default 3–5 req/menit).
- Webhook Polar memverifikasi signature dengan `POLAR_WEBHOOK_SECRET`.
- Submit token capture (HMAC) dengan TTL dan replay-protect (Upstash).
- Validasi env via Zod (`packages/env`) — boot gagal kalau env invalid.

---

## 9. DevOps & Deployment

### 9.1 Local

- Compose alternatif: `docker-compose.yml` (bundled Postgres) atau `docker-compose.external-db.yml`.
- Reverse proxy opsional: `docker-compose.caddy.yml`.

### 9.2 Production

- Build: `bun run build` (turbo, output per app).
- Image siap pakai: `ghcr.io/redpangilinan/crikket-server` & `crikket-web`.
- Deploy DB & storage managed.
- Set semua secret produksi via secret manager (AWS SM / Doppler / 1Password CLI).
- Health endpoint: `GET /` (server), `GET /` (web).

### 9.3 CI / Quality Gate

| Check | Command |
| --- | --- |
| Type check | `bun run check-types` |
| Lint / format | `bun run check` (ultracite/biome) |
| Auto fix | `bun run fix` |
| Unit test | (belum tersedia secara global; ditambahkan per package) |

Pre-commit hook via Husky + lint-staged otomatis menjalankan `ultracite fix` pada file yang di-stage.

---

## 10. Acceptance Checklist (Dev Ready)

- [ ] `bun install` sukses.
- [ ] Container `crikket-postgres-dev` up & `pg_isready` OK.
- [ ] Container `crikket-minio` up dan bucket `crikket-development` ada.
- [ ] `apps/server/.env`, `apps/web/.env`, `apps/extension/.env` terisi.
- [ ] `bun run db:push` sukses tanpa error.
- [ ] `bun run dev` menjalankan server, web, docs, extension tanpa error.
- [ ] Sign up & login berhasil di `http://localhost:3001`.
- [ ] Extension dapat di-load unpacked dari `apps/extension/.output/chrome-mv3`.
- [ ] Record + upload artefak ke MinIO sukses (no 403).
- [ ] (Opsional) Email OTP terkirim via Resend.

---

## 11. Out-of-Scope

- Mobile native app.
- On-prem fully air-gapped (storage S3-compatible tetap diperlukan).
- Multi-region active-active database.

---

Selesai — gunakan dokumen ini sebagai checklist setup, audit infra, dan basis ticket onboarding.
