# Crikket — Local Setup & Run Guide

Panduan lengkap menjalankan Crikket di lokal (macOS / Linux). Dokumen ini mengasumsikan Anda **belum** punya kredensial cloud (AWS/Polar/Resend/dll) dan ingin pakai stack lokal sepenuhnya.

> Stack: Bun + Turbo monorepo · Next.js (web/docs) · Hono (server) · Better Auth · Drizzle ORM · Postgres · MinIO (S3-compatible) · WXT (browser extension).

---

## 1. Prasyarat

| Tool | Versi minimum | Cek |
| --- | --- | --- |
| **Bun** | 1.3.5+ | `bun -v` |
| **Docker** | running | `docker info` |
| **Node** (opsional) | 20+ | `node -v` |
| **Chrome / Chromium** | terbaru | — |

Install Bun (jika belum):

```bash
curl -fsSL https://bun.sh/install | bash
```

---

## 2. Clone & Install

```bash
git clone <repo-url> crikket
cd crikket
bun install
```

> Postinstall otomatis menjalankan `wxt prepare` untuk extension.

---

## 3. Infrastruktur Lokal (Postgres + MinIO)

Project punya `docker-compose.yml` yang memakai port **5432** untuk Postgres. Jika port 5432 Anda sudah dipakai (PostgreSQL.app, Postgres lokal, dll), gunakan **port alternatif 5433** seperti panduan ini.

### 3.1 Postgres (port 5433)

```bash
docker run -d --name crikket-postgres-dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=crikket \
  -p 5433:5432 \
  postgres:17-alpine
```

Verifikasi:

```bash
docker exec crikket-postgres-dev pg_isready -U postgres
```

### 3.2 MinIO (S3-compatible storage)

```bash
docker run -d --name crikket-minio \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin123 \
  minio/minio server /data --console-address ":9001"
```

Buat bucket:

```bash
docker exec crikket-minio mc alias set local http://localhost:9000 minioadmin minioadmin123
docker exec crikket-minio mc mb -p local/crikket-development
docker exec crikket-minio mc anonymous set download local/crikket-development
```

- API:    http://localhost:9000
- Console: http://localhost:9001  (login `minioadmin` / `minioadmin123`)

---

## 4. Konfigurasi Environment

### 4.1 Root `.env`

Sudah ada di repo. Tidak perlu diubah untuk dev (hanya dipakai `docker-compose`).

### 4.2 Server `apps/server/.env`

Salin contoh kalau belum ada:

```bash
cp apps/server/.env.example apps/server/.env
```

Edit nilai berikut (sesuaikan dengan setup di atas):

```ini
NODE_ENV=development

# DATABASE — pakai port 5433 (Docker Postgres alt)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/crikket
CORS_ORIGINS=http://localhost:3001
ALLOWED_SIGNUP_DOMAINS=*

# AUTH
BETTER_AUTH_SECRET=<random-32-bytes>      # generate via: bun run generate:secret
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_COOKIE_DOMAIN=

# EMAIL (kosongkan kalau belum pakai Resend)
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@example.com

# OAUTH (opsional, kosongkan kalau tidak dipakai)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# PAYMENTS — DISABLE untuk dev lokal
ENABLE_PAYMENTS=false
POLAR_ACCESS_TOKEN=
POLAR_SUCCESS_URL=http://localhost:3001/success?checkout_id={CHECKOUT_ID}
POLAR_WEBHOOK_SECRET=
POLAR_PRO_PRODUCT_ID=
POLAR_PRO_YEARLY_PRODUCT_ID=
POLAR_STUDIO_PRODUCT_ID=
POLAR_STUDIO_YEARLY_PRODUCT_ID=

# STORAGE — MinIO lokal
STORAGE_BUCKET=crikket-development
STORAGE_ACCESS_KEY_ID=minioadmin
STORAGE_SECRET_ACCESS_KEY=minioadmin123
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_ADDRESSING_STYLE=path
STORAGE_PUBLIC_URL=

# CAPTURE SECURITY (opsional)
CAPTURE_SUBMIT_TOKEN_SECRET=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# RATE LIMIT (opsional)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Generate `BETTER_AUTH_SECRET`:

```bash
bun run generate:secret
```

### 4.3 Web `apps/web/.env`

```bash
cp apps/web/.env.example apps/web/.env
```

Pastikan:

```ini
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

### 4.4 Extension `apps/extension/.env`

```bash
cp apps/extension/.env.example apps/extension/.env
```

Default sudah benar untuk lokal:

```ini
VITE_APP_URL=http://localhost:3001
VITE_SERVER_URL=http://localhost:3000
```

---

## 5. Migrasi Database

Push schema Drizzle ke Postgres:

```bash
bun run db:push
```

Output sukses akan menampilkan `[✓] Changes applied`.

> Kalau Anda lebih suka migration file (bukan push), pakai:
> `bun run db:generate` lalu `bun run db:migrate`.

Cek studio Drizzle (opsional):

```bash
bun run db:studio
```

---

## 6. Jalankan Semua Service

```bash
bun run dev
```

Service yang aktif:

| Service | URL | Keterangan |
| --- | --- | --- |
| **server** | http://localhost:3000 | Hono + Better Auth + oRPC |
| **web** | http://localhost:3001 | Dashboard Next.js |
| **docs** | http://localhost:4000 | Fumadocs |
| **extension (WXT)** | http://localhost:5555 | Dev server extension |
| **postgres** | localhost:5433 | Docker container |
| **minio** | localhost:9000 / :9001 | S3 + Console |

Stop semuanya:

```bash
bun run kill:ports
docker stop crikket-postgres-dev crikket-minio
```

---

## 7. Buat Akun Pertama

Cara A — UI: buka http://localhost:3001, pilih **Sign up**.

Cara B — via API (cepat, langsung verified):

```bash
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@crikket.local","password":"Admin12345!","name":"Admin"}'
```

Tandai email verified (opsional, hilangkan banner):

```bash
docker exec crikket-postgres-dev psql -U postgres -d crikket \
  -c "UPDATE \"user\" SET email_verified = true WHERE email='admin@crikket.local';"
```

Login: `admin@crikket.local` / `Admin12345!`.

---

## 8. Install Browser Extension (Tanpa Web Store)

```bash
bun run --filter extension build
```

1. Buka `chrome://extensions`
2. Aktifkan **Developer mode** (toggle kanan-atas)
3. Klik **Load unpacked**
4. Tekan `Cmd+Shift+G` lalu paste path:
   ```
   /Users/<you>/crikket/apps/extension/.output/chrome-mv3
   ```
   > `.output` hidden di Finder; gunakan `Cmd+Shift+.` untuk show hidden, atau `Cmd+Shift+G` untuk paste path.
5. Pilih folder `chrome-mv3` (jangan masuk ke dalamnya).
6. Pin extension Crikket di toolbar.

Setelah edit kode extension, jalankan ulang `bun run --filter extension build` lalu klik **Reload** di `chrome://extensions`.

---

## 9. Skrip Bermanfaat

| Skrip | Fungsi |
| --- | --- |
| `bun run dev` | Jalankan semua service |
| `bun run dev:web` | Web only |
| `bun run dev:server` | Server only |
| `bun run dev:capture` | Build watch package capture |
| `bun run build` | Build production semua app |
| `bun run check-types` | Typecheck semua workspace |
| `bun run check` / `fix` | Lint via ultracite (biome) |
| `bun run db:push` | Sinkron schema → DB |
| `bun run db:studio` | Buka Drizzle Studio |
| `bun run db:generate` | Generate migration SQL |
| `bun run db:migrate` | Apply migration |
| `bun run kill:ports` | Bunuh proses di port 3000/3001/4000 |
| `bun run generate:secret` | Random 32-byte base64url |

---

## 10. Troubleshooting

### `EADDRINUSE port 3000`
Sudah ada server lama berjalan. Jalankan:
```bash
bun run kill:ports
```

### `password authentication failed for user "postgres"`
Postgres lokal lain memakai port 5432. Solusi: pakai port 5433 (lihat §3.1) dan pastikan `DATABASE_URL` memakai `:5433`.

### `Polar customer creation failed (401 invalid_token)`
Set `ENABLE_PAYMENTS=false` di `apps/server/.env` jika belum punya akun Polar.

### Upload artifact 403
Storage credentials placeholder. Pastikan `STORAGE_*` mengarah ke MinIO (lihat §4.2). Restart server setelah edit env.

### CORS error saat upload langsung ke MinIO
Set CORS bucket lewat MinIO console (`http://localhost:9001` → Buckets → Anonymous → tambahkan rule), atau kerjakan via `mc admin`:
```bash
docker exec crikket-minio mc anonymous set public local/crikket-development
```

### Folder `.output` tidak terlihat di Finder
Hidden folder (diawali titik). Toggle hidden: `Cmd+Shift+.`. Atau di file picker: `Cmd+Shift+G` lalu paste path.

### Extension tidak konek ke server
Cek `apps/extension/.env` — pastikan `VITE_SERVER_URL=http://localhost:3000`. Build ulang setelah ubah env.

### Email OTP / verifikasi tidak terkirim
`RESEND_API_KEY` kosong. Untuk dev, tandai user verified langsung via SQL (lihat §7).

### Reset semua data
```bash
docker rm -f crikket-postgres-dev crikket-minio
# lalu ulangi langkah §3
bun run db:push
```

---

## 11. Struktur Monorepo (singkat)

```
apps/
  server/        # Hono API + Better Auth + oRPC
  web/           # Next.js dashboard
  docs/          # Fumadocs
  extension/     # Browser extension (WXT)
packages/
  api/           # oRPC routers
  auth/          # Better Auth config
  billing/       # Polar integration
  bug-reports/   # Storage + cleanup logic
  capture-core/  # Shared capture utilities
  db/            # Drizzle schema + migrations
  env/           # Validated env (zod)
  shared/        # Cross-app utilities
  ui/            # Shared shadcn-style UI
sdks/            # Public SDKs (capture)
```

---

## 12. Catatan Production

Dokumen ini hanya untuk dev lokal. Untuk production:

- Gunakan Postgres managed (Supabase/Neon/RDS) dan set `DATABASE_URL` sesuai.
- Storage real (AWS S3 / Cloudflare R2) — atur `STORAGE_ENDPOINT` & `STORAGE_PUBLIC_URL`.
- `BETTER_AUTH_SECRET` baru (jangan reuse dev secret).
- `NODE_ENV=production`, cookies `Secure` + `SameSite=None`.
- Resend API key untuk email transaksional.
- Polar credentials kalau aktifkan billing (`ENABLE_PAYMENTS=true`).
- Reverse proxy via Caddy (`docker-compose.caddy.yml`) atau provider sendiri.

Selesai — happy hacking 🦗
