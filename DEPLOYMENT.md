# Crikket — Deployment & Environment Replication Guide

Dokumen ini adalah **snapshot dari environment lokal yang sudah terbukti berjalan** (macOS, 23 Juli 2026), ditulis supaya tim DevOps bisa mereplikasi environment yang **persis sama**, lalu naik ke staging/production.

Semua nilai di dokumen ini diambil langsung dari mesin yang sedang berjalan — bukan dari contoh generik. Nilai rahasia dimasking (`<...>`), nilai non-rahasia ditulis apa adanya.

| Dokumen | Isi |
| --- | --- |
| **DEPLOYMENT.md** (file ini) | Replikasi environment + deploy staging/production |
| [INSTALL.md](INSTALL.md) | Step-by-step instalasi dari nol (versi panjang) |
| [SETUP.md](SETUP.md) | Ringkasan setup + troubleshooting |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Functional & non-functional requirements |
| [wiki-crikket/](wiki-crikket/) | Wiki internal (arsitektur, env vars, spesifikasi server) |

---

## Daftar Isi

1. [Arsitektur runtime](#1-arsitektur-runtime)
2. [Baseline environment (yang terverifikasi jalan)](#2-baseline-environment-yang-terverifikasi-jalan)
3. [Prasyarat & versi tooling](#3-prasyarat--versi-tooling)
4. [Kode & versi repo](#4-kode--versi-repo)
5. [Infrastruktur lokal (Postgres + MinIO)](#5-infrastruktur-lokal-postgres--minio)
6. [Environment variables (semua file)](#6-environment-variables-semua-file)
7. [Database schema & migrasi](#7-database-schema--migrasi)
8. [Menjalankan aplikasi](#8-menjalankan-aplikasi)
9. [Akun pertama & data awal](#9-akun-pertama--data-awal)
10. [Browser extension](#10-browser-extension)
11. [Acceptance test — bukti environment sehat](#11-acceptance-test--bukti-environment-sehat)
12. [Operasional harian](#12-operasional-harian)
13. [Deployment staging / production](#13-deployment-staging--production)
14. [Perbedaan dev vs production](#14-perbedaan-dev-vs-production)
15. [Troubleshooting](#15-troubleshooting)
16. [Catatan penting & known issues](#16-catatan-penting--known-issues)

---

## 1. Arsitektur runtime

Monorepo Bun + Turborepo. Empat aplikasi + dua infrastruktur.

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser Extension (WXT / Chrome MV3)                           │
│  apps/extension — record video, screenshot, console, network    │
└───────────────┬─────────────────────────────────────────────────┘
                │ HTTP (oRPC) → :3000
┌───────────────▼──────────────┐        ┌──────────────────────────┐
│  Web Dashboard (Next.js 16)  │───────▶│  Server (Hono + Bun)     │
│  apps/web  :3001             │  oRPC  │  apps/server  :3000      │
│  Better Auth client          │        │  Better Auth + oRPC API  │
└──────────────────────────────┘        └────┬──────────────┬──────┘
                                             │              │
┌──────────────────────────────┐   Drizzle   │              │  S3 API
│  Docs (Fumadocs)  :4000      │             ▼              ▼
│  apps/docs                   │      ┌─────────────┐  ┌──────────────┐
└──────────────────────────────┘      │ PostgreSQL  │  │ MinIO (S3)   │
                                      │  :5433      │  │ :9000 /:9001 │
                                      └─────────────┘  └──────────────┘
```

**Packages pendukung:** `@crikket/api` (oRPC router), `@crikket/auth` (Better Auth), `@crikket/db` (Drizzle + schema + migrations), `@crikket/env` (validasi env via `@t3-oss/env-*` + Zod), `@crikket/ui`, `@crikket/bug-reports`, `@crikket/billing`, `@crikket/capture-core`, `@crikket-io/capture` (SDK).

**Peta port:**

| Port | Service | Sumber |
| --- | --- | --- |
| 3000 | API Server (Hono) | `apps/server` — `bun run --hot src/index.ts` |
| 3001 | Web Dashboard (Next.js) | `apps/web` — `next dev --port 3001` |
| 4000 | Docs (Next.js/Fumadocs) | `apps/docs` — `next dev --port=4000` |
| 5555 | Extension dev server (WXT) | `apps/extension` — `wxt --port 5555` |
| 5433 | PostgreSQL 17 | Docker `crikket-postgres-dev` (host 5433 → container 5432) |
| 9000 | MinIO S3 API | Docker `crikket-minio` |
| 9001 | MinIO Console (UI) | Docker `crikket-minio` |

---

## 2. Baseline environment (yang terverifikasi jalan)

Ini kondisi mesin referensi. DevOps harus mencocokkan minimal versi mayor yang sama.

| Komponen | Nilai di mesin referensi | Cara cek |
| --- | --- | --- |
| OS | macOS (Darwin 25.3.0), shell `zsh` | `uname -a` |
| Bun | **1.3.14** (pin repo: `bun@1.3.5`, jadi minimal 1.3.5) | `bun -v` |
| Node.js | v22.23.1 (opsional, hanya untuk tooling) | `node -v` |
| Docker Engine | 29.3.1 | `docker --version` |
| Docker Compose | v5.1.0 | `docker compose version` |
| PostgreSQL | `postgres:17-alpine` (PG 17.10) di Docker | `docker exec crikket-postgres-dev psql -V` |
| Object storage | `minio/minio` di Docker, bucket `crikket-development` | `docker exec crikket-minio mc ls local` |
| Package manager | Bun workspaces + catalog (bukan npm/pnpm/yarn) | `package.json` → `packageManager` |
| Build orchestrator | Turborepo 2.6.x | `bunx turbo --version` |

> ⚠️ **Jangan pakai npm/yarn/pnpm.** Repo memakai `bun.lock` + Bun *catalog* (`catalog:` di dependencies). Package manager lain akan gagal me-resolve.

**Spesifikasi mesin minimum untuk dev:** 4 core / 8 GB RAM / 10 GB disk kosong. Rekomendasi 8 core / 16 GB (Next.js dev + Turbo menjalankan 4 proses paralel). Detail per skala ada di [wiki-crikket/10-spesifikasi-server.md](wiki-crikket/10-spesifikasi-server.md).

---

## 3. Prasyarat & versi tooling

### 3.1 Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
exec $SHELL
bun -v            # harus >= 1.3.5
```

### 3.2 Install Docker

macOS/Windows: Docker Desktop. Linux: Docker Engine + plugin compose.

```bash
docker info | head -5      # harus tampil info server, bukan error
docker compose version     # harus v2+ (referensi: v5.1.0)
```

### 3.3 (Opsional) Chrome / Chromium

Wajib hanya kalau ikut menguji browser extension. Edge/Brave juga bisa (Chromium MV3).

---

## 4. Kode & versi repo

```bash
git clone https://github.com/redpangilinan/crikket.git crikket
cd crikket
bun install
```

**Baseline commit environment referensi:**

```
branch : master
commit : 134f574cef995818c74004275272fc8e3319cc73  (chore: update bun.lock)
remote : https://github.com/redpangilinan/crikket.git
```

Kunci ke commit yang sama bila ingin identik:

```bash
git checkout 134f574
```

### 4.1 ⚠️ Perubahan lokal yang BELUM di-commit

Mesin referensi punya perubahan yang belum masuk git. Kalau DevOps hanya `git clone`, tampilan dashboard **tidak akan sama**. Perubahan tersebut:

**Modified**
```
apps/web/src/app/(protected)/(dashboard)/_components/bug-reports/bug-report-card.tsx
apps/web/src/app/(protected)/(dashboard)/_components/bug-reports/bug-reports-list.tsx
apps/web/src/app/(protected)/(dashboard)/_components/bug-reports/bug-reports-toolbar.tsx
apps/web/src/app/(protected)/(dashboard)/page.tsx
apps/web/src/app/layout.tsx
packages/ui/src/styles/dashboard.css
packages/ui/src/styles/globals.css
```

**Untracked (baru)**
```
apps/web/src/app/(protected)/(dashboard)/_components/install-extension-card.tsx
INSTALL.md  SETUP.md  REQUIREMENTS.md  DEPLOYMENT.md  docker-compose.dev.yml
supabase-crikket-schema.sql  supabase-crikket-seed.sql
supabase-crikket-seed-safe.sql  supabase-crikket-enable-rls.sql
wiki-crikket/
```

**Cara membagikan ke DevOps — pilih salah satu (rekomendasi: opsi A):**

**A. Push ke branch** (paling bersih, bisa di-review & di-deploy)
```bash
git checkout -b feat/local-dashboard-ui
git add -A
git commit -m "feat(web): dashboard UI updates + deployment docs"
git push -u origin feat/local-dashboard-ui
```
DevOps: `git fetch origin && git checkout feat/local-dashboard-ui`

**B. Kirim patch file** (kalau belum boleh push)
```bash
git add -A && git stash
git stash show -p stash@{0} > crikket-local-changes.patch
git stash pop
```
DevOps: `git apply crikket-local-changes.patch`

> File `supabase-crikket-*.sql` adalah jalur alternatif kalau database dihosting di Supabase (schema + seed + RLS). **Tidak dipakai** pada setup lokal referensi yang memakai Postgres Docker — lihat [§13.3](#133-opsi-c-database-eksternal-supabase--neon--rds).

---

## 5. Infrastruktur lokal (Postgres + MinIO)

Mesin referensi menjalankan dua container. Sekarang keduanya sudah dibungkus dalam [docker-compose.dev.yml](docker-compose.dev.yml) supaya deterministik.

### 5.1 Cara direkomendasikan — Compose

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps
```

Compose ini membuat:

| Service | Container | Port host | Volume |
| --- | --- | --- | --- |
| `postgres` | `crikket-postgres-dev` | `5433 → 5432` | `crikket_pgdata` |
| `minio` | `crikket-minio` | `9000`, `9001` | `crikket_minio_data` |
| `minio-init` | `crikket-minio-init` | — (sekali jalan) | — |

`minio-init` otomatis membuat bucket `crikket-development` **dan** menerapkan policy `download` (public read). Tanpa policy ini, artifact screenshot/video akan **403** saat dibuka dari dashboard.

Override port/kredensial lewat root `.env` bila perlu: `DEV_POSTGRES_PORT`, `DEV_MINIO_API_PORT`, `DEV_MINIO_ROOT_USER`, `DEV_MINIO_ROOT_PASSWORD`, `DEV_STORAGE_BUCKET`.

### 5.2 Cara manual (persis seperti mesin referensi dibuat)

Kalau tidak mau pakai compose, ini perintah asli yang menghasilkan container yang sedang berjalan:

```bash
# PostgreSQL — host port 5433 supaya tidak bentrok dengan Postgres lokal di 5432
docker run -d --name crikket-postgres-dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=crikket \
  -p 5433:5432 \
  postgres:17-alpine

# MinIO — S3-compatible storage
docker run -d --name crikket-minio \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin123 \
  minio/minio server /data --console-address ":9001"

# Bucket + policy public-read (WAJIB)
docker exec crikket-minio mc alias set local http://localhost:9000 minioadmin minioadmin123
docker exec crikket-minio mc mb -p local/crikket-development
docker exec crikket-minio mc anonymous set download local/crikket-development
```

### 5.3 Verifikasi infrastruktur

```bash
docker exec crikket-postgres-dev pg_isready -U postgres          # → accepting connections
docker exec crikket-minio mc ls local                            # → crikket-development/
docker exec crikket-minio mc anonymous get local/crikket-development
#   → Access permission for `local/crikket-development` is `download`
```

MinIO Console: http://localhost:9001 (login `minioadmin` / `minioadmin123`).

> ℹ️ Kredensial `minioadmin/minioadmin123` dan `postgres/postgres` **hanya untuk lokal**. Jangan pernah dipakai di staging/production.

---

## 6. Environment variables (semua file)

Ada **5 file `.env`**. Semuanya di-`.gitignore` dan **tidak** ikut masuk Docker image (lihat `.dockerignore`), jadi harus dibuat manual di tiap mesin / diinjeksi dari secret manager.

```bash
cp .env.example .env
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
cp apps/docs/.env.example apps/docs/.env
cp apps/extension/.env.example apps/extension/.env
```

Generate secret Better Auth (minimal 32 karakter — divalidasi Zod):

```bash
bun run generate:secret
```

### 6.1 Root `.env` — dipakai Docker Compose saja

Isi persis di mesin referensi (semua default, tidak diubah):

```ini
WEB_PORT=3001
SERVER_PORT=3000
POSTGRES_PORT=5432

CRIKKET_DATABASE_MODE=bundled

CRIKKET_PROXY_MODE=
CADDY_HTTP_PORT=80
CADDY_HTTPS_PORT=443
CADDY_ACME_EMAIL=
CADDY_PUBLIC_HOST=

POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=crikket
POSTGRES_HOST_AUTH_METHOD=scram-sha-256
```

> File ini **tidak berpengaruh** pada `bun run dev`. Hanya dibaca `docker-compose*.yml`. Untuk dev, yang menentukan adalah `apps/server/.env`.

### 6.2 `apps/server/.env` — yang paling penting

Nilai persis di mesin referensi:

```ini
NODE_ENV=development

# ---------- DATABASE & INFRA ----------
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/crikket
CORS_ORIGINS=http://localhost:3001
ALLOWED_SIGNUP_DOMAINS=*

# ---------- RATE LIMITING (opsional, kosong di lokal) ----------
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# ---------- AUTH (Better Auth) ----------
BETTER_AUTH_SECRET=<32+ char random — hasil `bun run generate:secret`>
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_COOKIE_DOMAIN=

# ---------- EMAIL (opsional, kosong di lokal) ----------
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@example.com

# ---------- OAUTH (placeholder di lokal — belum aktif) ----------
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ---------- PAYMENTS (dimatikan di lokal) ----------
ENABLE_PAYMENTS=false
POLAR_ACCESS_TOKEN=your_polar_access_token
POLAR_SUCCESS_URL=http://localhost:3001/success?checkout_id={CHECKOUT_ID}
POLAR_WEBHOOK_SECRET=your_polar_webhook_secret
POLAR_PRO_PRODUCT_ID=your_polar_pro_product_id
POLAR_PRO_YEARLY_PRODUCT_ID=your_polar_pro_yearly_product_id
POLAR_STUDIO_PRODUCT_ID=your_polar_studio_product_id
POLAR_STUDIO_YEARLY_PRODUCT_ID=your_polar_studio_yearly_product_id

# ---------- STORAGE (MinIO lokal) ----------
STORAGE_BUCKET=crikket-development
STORAGE_ACCESS_KEY_ID=minioadmin
STORAGE_SECRET_ACCESS_KEY=minioadmin123
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_ADDRESSING_STYLE=path
STORAGE_PUBLIC_URL=

# ---------- CAPTURE SECURITY (opsional, kosong di lokal) ----------
CAPTURE_SUBMIT_TOKEN_SECRET=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

**Empat variabel yang paling sering salah:**

| Variabel | Kenapa krusial |
| --- | --- |
| `DATABASE_URL` | Harus port **5433**, bukan 5432 — sesuai mapping container dev. |
| `STORAGE_ADDRESSING_STYLE=path` | MinIO tidak mendukung virtual-hosted style. Kalau `auto`/`virtual`, upload gagal. |
| `CORS_ORIGINS` | Harus memuat origin web (`http://localhost:3001`), dipakai CORS **dan** trusted origins Better Auth. |
| `BETTER_AUTH_SECRET` | Zod menolak < 32 karakter → server crash saat boot. |

**Aturan validasi (`packages/env/src/server.ts`, Zod):** wajib = `DATABASE_URL`, `BETTER_AUTH_SECRET` (min 32), `BETTER_AUTH_URL` (URL valid). Sisanya optional. `ENABLE_PAYMENTS` hanya menerima `"true"`/`"false"` (**default `true`** — jadi harus eksplisit `false` kalau billing tidak dipakai). String kosong diperlakukan sebagai `undefined` (`emptyStringAsUndefined: true`), jadi aman mengosongkan variabel opsional.

### 6.3 `apps/web/.env`

```ini
NEXT_PUBLIC_SITE_URL=https://crikket.io
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true

NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
NEXT_PUBLIC_CRIKKET_KEY=
```

> ⚠️ `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` sementara `GOOGLE_CLIENT_ID` di server masih placeholder → tombol "Sign in with Google" muncul tapi **error saat diklik**. Kalau DevOps tidak menyiapkan OAuth credentials, set `false`. Detail di [§16](#16-catatan-penting--known-issues).

Wajib berupa URL valid: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SERVER_URL` (`packages/env/src/web.ts`).

### 6.4 `apps/docs/.env`

```ini
NEXT_PUBLIC_SITE_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
NEXT_PUBLIC_DEMO_URL=http://localhost:3001/s/demo

NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

### 6.5 `apps/extension/.env`

```ini
VITE_APP_URL=http://localhost:3001
VITE_SERVER_URL=http://localhost:3000
```

> Nilai ini di-*bundle* saat build. Kalau diubah, extension **wajib di-build ulang** dan di-reload di `chrome://extensions`.

---

## 7. Database schema & migrasi

Ada dua jalur, dan **mesin referensi memakai jalur A**:

### A. `db:push` — dipakai di lokal

```bash
bun run db:push        # drizzle-kit push --filter=@crikket/db
```

Drizzle membaca `packages/db/drizzle.config.ts`, yang memuat env dari `../../apps/server/.env` — jadi `DATABASE_URL` server yang menentukan target push.

Kondisi terverifikasi di mesin referensi: **19 tabel** ada di schema `public`, tabel `drizzle.__drizzle_migrations` **tidak ada** — konfirmasi bahwa schema diterapkan via `push`, bukan ledger migrasi.

```
account · billing_webhook_event · bug_report · bug_report_action
bug_report_artifact_cleanup · bug_report_ingestion_job · bug_report_log
bug_report_network_request · bug_report_upload_session · capture_public_key
invitation · member · organization · organization_billing_account
organization_entitlement · rate_limit · session · user · verification
```

### B. `db:migrate` — WAJIB untuk staging & production

```bash
bun run db:generate    # bikin file migrasi dari perubahan schema
bun run db:migrate     # terapkan migrasi
```

> ⚠️ **Kebijakan untuk DevOps:** `db:push` mengubah schema langsung tanpa jejak versi dan **berisiko drop kolom/data**. Di staging/production hanya boleh `db:migrate`. `docker-compose.yml` sudah menjalankan ini otomatis lewat service `migrate` sebelum server naik.

### Verifikasi & tools

```bash
docker exec crikket-postgres-dev psql -U postgres -d crikket -c "\dt"
bun run db:studio      # Drizzle Studio (GUI)
```

---

## 8. Menjalankan aplikasi

```bash
bun run dev            # turbo run dev — semua app sekaligus
```

Output yang diharapkan:

```
server:dev:    Started development server: http://localhost:3000
web:dev:       ✓ Ready in 1.8s
docs:dev:      ✓ Ready in 1.5s
extension:dev: ✔ Started dev server @ http://localhost:5555
```

Menjalankan sebagian saja:

```bash
bun run dev:server     # hanya API      :3000
bun run dev:web        # hanya dashboard :3001
bun run dev:capture    # hanya SDK capture
bun run --filter docs dev
```

Urutan start yang benar: **Docker (Postgres+MinIO) → `db:push`/`db:migrate` → `bun run dev`**. Server akan crash saat boot kalau database belum siap atau env belum valid.

---

## 9. Akun pertama & data awal

Tidak ada seeder otomatis. Buat akun lewat UI atau API.

**Via API (paling cepat):**

```bash
curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@crikket.local","password":"Admin12345!","name":"Admin"}'
```

Sukses → JSON `{"token":"...","user":{...}}`.

**Hilangkan banner "email not verified"** (karena Resend belum dikonfigurasi di lokal):

```bash
docker exec crikket-postgres-dev psql -U postgres -d crikket \
  -c "UPDATE \"user\" SET email_verified = true WHERE email='admin@crikket.local';"
```

Login di http://localhost:3001 dengan `admin@crikket.local` / `Admin12345!`.

> `ALLOWED_SIGNUP_DOMAINS=*` mengizinkan semua domain mendaftar. Di production, batasi ke domain perusahaan (mis. `perusahaan.com,partner.com`).

---

## 10. Browser extension

```bash
bun run --filter extension build     # output: apps/extension/.output/chrome-mv3
```

Load di Chrome:

1. Buka `chrome://extensions`
2. Aktifkan **Developer mode**
3. **Load unpacked** → pilih folder `apps/extension/.output/chrome-mv3`
   (di macOS, `Cmd+Shift+G` lalu paste path absolut; folder `.output` hidden karena diawali titik — `Cmd+Shift+.` untuk menampilkannya)
4. Pin ikon Crikket di toolbar

Mode HMR saat development: `bun run dev` sudah menjalankan WXT di port 5555 dan menghasilkan `.output/chrome-mv3-dev` — load folder itu untuk auto-reload.

Shortcut bawaan: `Alt+Shift+R` (rekam), `Alt+Shift+S` (stop), `Alt+Shift+C` (screenshot).

Firefox: `bun run --filter extension build:firefox`.

---

## 11. Acceptance test — bukti environment sehat

Jalankan berurutan. Semua harus lulus sebelum environment dinyatakan siap.

```bash
# 1. Infrastruktur
docker compose -f docker-compose.dev.yml ps           # postgres & minio = running/healthy
docker exec crikket-postgres-dev pg_isready -U postgres

# 2. Database (harus 19 tabel)
docker exec crikket-postgres-dev psql -U postgres -d crikket \
  -c "select count(*) from information_schema.tables where table_schema='public';"

# 3. Storage
docker exec crikket-minio mc anonymous get local/crikket-development   # → `download`

# 4. API server
curl -s -o /dev/null -w "server: %{http_code}\n" http://localhost:3000

# 5. Web dashboard
curl -s -o /dev/null -w "web: %{http_code}\n" http://localhost:3001

# 6. Docs
curl -s -o /dev/null -w "docs: %{http_code}\n" http://localhost:4000

# 7. Auth end-to-end
curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"qa@crikket.local","password":"Qa12345678!","name":"QA"}' | head -c 200

# 8. Quality gate
bun run check-types
bun run check
```

**Checklist manual:**

- [ ] Login berhasil di http://localhost:3001, dashboard tampil
- [ ] Extension ter-load di `chrome://extensions` tanpa error
- [ ] Rekam video/screenshot dari extension → bug report muncul di dashboard
- [ ] Artifact (screenshot/video) bisa diputar/dibuka — bukan 403
- [ ] Object baru terlihat di MinIO Console (http://localhost:9001) di bucket `crikket-development`

---

## 12. Operasional harian

```bash
# Start pagi hari
docker compose -f docker-compose.dev.yml up -d
bun run dev

# Stop
#   Ctrl+C di terminal dev, lalu:
docker compose -f docker-compose.dev.yml down          # data tetap ada

# Port nyangkut (3000/3001/4000)
bun run kill:ports

# Bersihkan build artifacts (node_modules, .next, .turbo, dist)
bun run clean && bun install

# Reset total — HAPUS SEMUA DATA
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d
bun run db:push
```

Script bawaan repo di [scripts/](scripts/): `setup.sh` (wizard self-host), `start.sh`, `restart.sh`, `update.sh`, `backup-db.sh`, `healthcheck.sh`.

Quality gate (dijalankan otomatis oleh Husky + lint-staged saat commit):

```bash
bun run check-types    # tsc --noEmit di semua workspace
bun run check          # ultracite / Biome
bun run fix            # auto-fix
```

---

## 13. Deployment staging / production

Repo menyediakan tiga file compose + image siap pakai di GHCR:

- `ghcr.io/redpangilinan/crikket-server:latest`
- `ghcr.io/redpangilinan/crikket-web:latest`

| File | Skenario |
| --- | --- |
| `docker-compose.yml` | Postgres ikut di-host (bundled) |
| `docker-compose.external-db.yml` | Database eksternal (Supabase / Neon / RDS) |
| `docker-compose.caddy.yml` | Tambahan reverse proxy Caddy + auto-HTTPS |

Semua compose ini membaca `apps/server/.env` dan `apps/web/.env` lewat `env_file` — jadi **file env harus ada di server tujuan** (tidak ikut ke image; `.dockerignore` mengecualikannya).

### 13.1 Opsi A — Wizard (paling cepat)

```bash
git clone https://github.com/redpangilinan/crikket
cd crikket
./scripts/setup.sh
```

Wizard mengurus: pembuatan file env, generate secret, prompt domain, setup Caddy, dan start Docker.

### 13.2 Opsi B — Manual, bundled Postgres

```bash
# 1. Siapkan env production
cp .env.example .env
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
#    edit sesuai §14

# 2. Start
docker compose up -d

# 3. Cek
docker compose ps
docker compose logs -f server
./scripts/healthcheck.sh
```

Alur `docker-compose.yml`: `postgres` (healthy) → `migrate` (jalankan `db:migrate`, exit 0) → `server` (:3000 + :3001) → `web` (share network namespace server).

### 13.3 Opsi C — Database eksternal (Supabase / Neon / RDS)

```bash
docker compose -f docker-compose.external-db.yml up -d
```

Set `DATABASE_URL` ke connection string provider (biasanya perlu `?sslmode=require`). Kalau memakai Supabase, file `supabase-crikket-schema.sql`, `supabase-crikket-seed-safe.sql`, dan `supabase-crikket-enable-rls.sql` di root repo bisa dipakai untuk provisioning awal via SQL Editor — tapi jalur yang direkomendasikan tetap `bun run db:migrate` supaya schema selalu sinkron dengan Drizzle.

### 13.4 Reverse proxy + HTTPS (Caddy)

Isi di root `.env`:

```ini
CRIKKET_PROXY_MODE=caddy
CADDY_ACME_EMAIL=devops@perusahaan.com
CADDY_PUBLIC_HOST=crikket.perusahaan.com
CADDY_HTTP_PORT=80
CADDY_HTTPS_PORT=443
```

Lalu:

```bash
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d
```

`Caddyfile` mengarahkan `/api/*` dan `/rpc/*` → `server:3000`, sisanya → `server:3001` (web). Domain diambil dari `NEXT_PUBLIC_APP_URL`, jadi nilai itu harus URL publik production.

### 13.5 Backup & update

```bash
./scripts/backup-db.sh      # dump Postgres
./scripts/update.sh         # pull image terbaru + restart + migrate
./scripts/healthcheck.sh    # cek kesehatan semua service
```

Jadwalkan `backup-db.sh` via cron (harian) dan simpan dump ke object storage terpisah.

---

## 14. Perbedaan dev vs production

Tabel delta yang **wajib** diubah saat naik ke production:

| Variabel | Lokal (dev) | Production |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/crikket` | Managed DB + `sslmode=require`, user khusus |
| `BETTER_AUTH_SECRET` | secret dev | **Secret baru**, jangan reuse |
| `BETTER_AUTH_URL` | `http://localhost:3000` | `https://<domain>` |
| `BETTER_AUTH_COOKIE_DOMAIN` | kosong | isi bila cookie dishare antar subdomain |
| `CORS_ORIGINS` | `http://localhost:3001` | origin web production (HTTPS) |
| `ALLOWED_SIGNUP_DOMAINS` | `*` | daftar domain perusahaan |
| `STORAGE_ENDPOINT` | `http://localhost:9000` (MinIO) | S3 / R2 (kosongkan untuk AWS S3 native) |
| `STORAGE_ADDRESSING_STYLE` | `path` | `auto` (AWS) / `path` (R2 & MinIO) |
| `STORAGE_BUCKET` | `crikket-development` | bucket production |
| `STORAGE_ACCESS_KEY_ID` / `SECRET` | `minioadmin` / `minioadmin123` | IAM key dengan least privilege |
| `STORAGE_PUBLIC_URL` | kosong (signed URL) | CDN URL bila artifact dilayani lewat CDN |
| `RESEND_API_KEY` | kosong | API key asli (verifikasi email & invite tidak jalan tanpanya) |
| `RESEND_FROM_EMAIL` | `noreply@example.com` | domain terverifikasi di Resend |
| `ENABLE_PAYMENTS` | `false` | `true` + semua `POLAR_*` bila billing dipakai |
| `GOOGLE_CLIENT_ID` / `SECRET` | placeholder | credential asli; redirect URI `https://<domain>/api/auth/callback/google` |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | `true` (padahal creds placeholder) | `true` hanya bila OAuth benar-benar dikonfigurasi |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | kosong | **wajib** untuk rate limiting & replay protection |
| `CAPTURE_SUBMIT_TOKEN_SECRET` | kosong | isi (min 32) bila capture publik diaktifkan |
| `TURNSTILE_SITE_KEY` / `SECRET_KEY` | kosong | isi bila capture publik tanpa auth |
| `NEXT_PUBLIC_*_URL` | `http://localhost:*` | URL HTTPS production |
| Schema DB | `db:push` | `db:migrate` saja |

**Checklist production:**

- [ ] Semua secret dari secret manager (AWS SM / Doppler / 1Password), bukan file di repo
- [ ] `BETTER_AUTH_SECRET` baru & unik per environment
- [ ] HTTPS aktif (cookie `Secure` + `SameSite`)
- [ ] Database managed + backup otomatis + retensi teruji restore
- [ ] Object storage production dengan lifecycle policy untuk artifact
- [ ] Upstash Redis aktif (rate limit)
- [ ] `CORS_ORIGINS` tidak memuat localhost
- [ ] Migrasi via `db:migrate`, bukan `db:push`
- [ ] Monitoring / uptime check ke `GET /` server & web
- [ ] `bun run check-types` dan `bun run check` hijau di CI sebelum deploy

---

## 15. Troubleshooting

| Gejala | Penyebab | Solusi |
| --- | --- | --- |
| `EADDRINUSE :3000/:3001/:4000` | Proses dev lama masih hidup | `bun run kill:ports` |
| `password authentication failed for user "postgres"` | `DATABASE_URL` menunjuk Postgres lokal di 5432, bukan container di 5433 | Pastikan port **5433** di `DATABASE_URL` |
| `ECONNREFUSED 127.0.0.1:5433` | Container Postgres belum jalan | `docker compose -f docker-compose.dev.yml up -d` |
| Server exit saat boot, error Zod | Env tidak lolos validasi (`BETTER_AUTH_SECRET` < 32, URL tidak valid) | Perbaiki `apps/server/.env`, regenerate secret |
| Upload artifact **403** | Bucket belum ber-policy `download` | `docker exec crikket-minio mc anonymous set download local/crikket-development` |
| Upload gagal / SignatureDoesNotMatch | `STORAGE_ADDRESSING_STYLE` bukan `path` | Set `path` untuk MinIO |
| CORS error saat upload | `CORS_ORIGINS` tidak memuat origin web | Tambahkan `http://localhost:3001` |
| Login sukses tapi langsung logout | `BETTER_AUTH_URL` / `NEXT_PUBLIC_SERVER_URL` tidak konsisten | Samakan keduanya ke `http://localhost:3000` |
| Tombol Google login error | OAuth credential masih placeholder | Set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false` atau isi credential asli |
| Extension tidak konek ke server | `apps/extension/.env` berubah tapi belum di-build ulang | `bun run --filter extension build` + reload di `chrome://extensions` |
| Folder `.output` tak terlihat di Finder | Hidden folder (diawali titik) | `Cmd+Shift+.` di Finder |
| Email OTP / verifikasi tidak terkirim | `RESEND_API_KEY` kosong | Normal di lokal — set `email_verified=true` manual (§9) |
| `Polar customer creation failed (401)` | Billing aktif tapi token placeholder | `ENABLE_PAYMENTS=false` di lokal |
| Dependency error aneh setelah pull | Lockfile/cache stale | `bun run clean && bun install` |

Referensi tambahan: [SETUP.md §10](SETUP.md), [wiki-crikket/08-troubleshooting.md](wiki-crikket/08-troubleshooting.md).

---

## 16. Catatan penting & known issues

1. **Port Postgres berbeda antara dev dan compose.** `docker-compose.yml` (production) memakai `5432`, sedangkan setup dev memakai `5433` supaya tidak bentrok dengan Postgres lokal. Jangan menyalin `DATABASE_URL` antar environment tanpa mengecek port.

2. **Schema lokal dibuat dengan `db:push`, tanpa ledger migrasi.** Tabel `drizzle.__drizzle_migrations` tidak ada di database dev. Kalau environment ini nanti dipromosikan, jalankan `db:migrate` di database bersih — jangan campur kedua jalur di satu database.

3. **Google OAuth setengah aktif.** `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` tapi `GOOGLE_CLIENT_ID`/`SECRET` masih string placeholder → tombol muncul, klik gagal. Ini kondisi apa adanya di mesin referensi; DevOps sebaiknya set `false` atau isi credential asli.

4. **Email belum aktif.** `RESEND_API_KEY` kosong → verifikasi email, invite anggota organisasi, dan reset password tidak terkirim di lokal. Workaround dev: update kolom `email_verified` langsung di DB.

5. **Rate limiting non-aktif.** `UPSTASH_REDIS_REST_URL`/`TOKEN` kosong → tidak ada rate limit dan tidak ada replay protection untuk capture submit token. Wajib diaktifkan sebelum endpoint publik diekspos.

6. **Billing dimatikan.** `ENABLE_PAYMENTS=false`. Perhatikan: default schema Zod adalah `true`, jadi kalau variabel ini hilang dari env production, billing ikut aktif dan Polar akan dipanggil.

7. **File `.env` tidak ikut ke image.** `.dockerignore` mengecualikan `apps/web/.env` dan `apps/server/.env`. Di server tujuan, file env harus disediakan terpisah atau diinjeksi dari secret manager.

8. **Kredensial lokal bersifat lemah dan disengaja.** `postgres/postgres` dan `minioadmin/minioadmin123` hanya untuk mesin developer. Jangan pernah dipakai di jaringan yang bisa diakses publik.

9. **Bun catalog.** Versi dependency dipusatkan di `package.json` root (`workspaces.catalog`). Menambah/menaikkan versi harus lewat catalog, bukan di package individual.

---

**Ringkasan urutan replikasi (TL;DR untuk DevOps):**

```bash
# 1. Tooling
curl -fsSL https://bun.sh/install | bash && exec $SHELL   # bun >= 1.3.5
docker info                                               # docker jalan

# 2. Kode
git clone https://github.com/redpangilinan/crikket.git crikket && cd crikket
git checkout feat/local-dashboard-ui     # atau: git checkout 134f574
bun install

# 3. Infrastruktur
docker compose -f docker-compose.dev.yml up -d

# 4. Env (5 file) — ikuti §6, lalu:
bun run generate:secret                  # → BETTER_AUTH_SECRET

# 5. Database
bun run db:push

# 6. Jalankan
bun run dev

# 7. Akun pertama
curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@crikket.local","password":"Admin12345!","name":"Admin"}'
docker exec crikket-postgres-dev psql -U postgres -d crikket \
  -c "UPDATE \"user\" SET email_verified = true WHERE email='admin@crikket.local';"

# 8. Extension
bun run --filter extension build         # load apps/extension/.output/chrome-mv3

# 9. Acceptance test — §11
```

*Dokumen ini dibuat dari inspeksi langsung environment lokal pada 23 Juli 2026. Bila konfigurasi lokal berubah, perbarui dokumen ini agar tetap menjadi sumber kebenaran.*
