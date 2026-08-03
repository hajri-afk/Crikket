# Crikket — Langkah Setup Lengkap (Step-by-Step)

Panduan dari **nol** sampai project **berjalan + bisa login + extension aktif + upload bekerja**.
Ikuti urut, copy-paste tiap blok perintah. Total ~15 menit (di luar download Docker image).

> Diuji di **macOS 14+ (Apple Silicon & Intel)**. Untuk Linux mirip; Windows pakai WSL2.

---

## ✅ Checklist Singkat

- [ ] LANGKAH 1 — Install Bun + Docker
- [ ] LANGKAH 2 — Clone repo & install dependencies
- [ ] LANGKAH 3 — Jalankan Postgres (Docker)
- [ ] LANGKAH 4 — Jalankan MinIO + buat bucket
- [ ] LANGKAH 5 — Konfigurasi file `.env`
- [ ] LANGKAH 6 — Migrasi database
- [ ] LANGKAH 7 — Jalankan semua service
- [ ] LANGKAH 8 — Buat akun admin
- [ ] LANGKAH 9 — Build & install browser extension
- [ ] LANGKAH 10 — Tes record + upload
- [ ] LANGKAH 11 — Stop / start kembali

---

## LANGKAH 1 — Install Tooling Dasar

### 1.1 Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

Reload shell:

```bash
exec $SHELL
bun -v        # harus ≥ 1.3.5
```

### 1.2 Install Docker Desktop

Download: https://www.docker.com/products/docker-desktop
Setelah terinstall, buka aplikasinya supaya daemon jalan, lalu cek:

```bash
docker info | head -5
```

Jika muncul info server (bukan error), Docker siap.

### 1.3 (Opsional) Pasang Chrome / Chromium

Wajib hanya kalau mau pakai extension. Edge / Brave juga bisa.

---

## LANGKAH 2 — Clone Project & Install Dependencies

```bash
git clone <REPO_URL> crikket
cd crikket
bun install
```

> Postinstall otomatis menjalankan `wxt prepare` untuk extension. Tunggu sampai selesai.

Cek struktur:

```bash
ls apps packages
# apps:     docs extension server web
# packages: api auth billing bug-reports capture-core config db env shared ui
```

---

## LANGKAH 3 — Jalankan Database (PostgreSQL via Docker)

> Project default pakai port **5432**. Jika port itu sudah dipakai (mis. PostgreSQL.app), kita pakai **5433** supaya tidak bentrok.

### 3.1 Cek port 5432

```bash
lsof -i :5432 -sTCP:LISTEN | head -3
```

- Kalau **kosong** → pakai port 5432 (skip ke 3.2 dengan `-p 5432:5432`).
- Kalau **terisi** → tetap pakai 5433 seperti contoh di bawah.

### 3.2 Jalankan container Postgres

```bash
docker run -d --name crikket-postgres-dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=crikket \
  -p 5433:5432 \
  postgres:17-alpine
```

### 3.3 Verifikasi

```bash
sleep 3
docker exec crikket-postgres-dev pg_isready -U postgres
# Output harus: /var/run/postgresql:5432 - accepting connections
```

---

## LANGKAH 4 — Jalankan Object Storage (MinIO)

MinIO menggantikan AWS S3 / Cloudflare R2 untuk lokal. Tanpa ini, upload artefak akan **403**.

### 4.1 Jalankan MinIO

```bash
docker run -d --name crikket-minio \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin123 \
  minio/minio server /data --console-address ":9001"
```

### 4.2 Buat bucket `crikket-development`

```bash
sleep 4
docker exec crikket-minio mc alias set local http://localhost:9000 minioadmin minioadmin123
docker exec crikket-minio mc mb -p local/crikket-development
docker exec crikket-minio mc anonymous set download local/crikket-development
```

Console: http://localhost:9001 (login `minioadmin` / `minioadmin123`).

---

## LANGKAH 5 — Konfigurasi File `.env`

### 5.1 Generate secret untuk Better Auth

```bash
bun run generate:secret
# salin output, contoh: LHqIigxewq9FD28CFn1iClPPT7PdU3KOTwBz0ywAQew=
```

### 5.2 `apps/server/.env`

```bash
cp apps/server/.env.example apps/server/.env
```

Edit file `apps/server/.env`. Pastikan baris-baris ini sesuai:

```ini
NODE_ENV=development

DATABASE_URL=postgresql://postgres:postgres@localhost:5433/crikket
CORS_ORIGINS=http://localhost:3001
ALLOWED_SIGNUP_DOMAINS=*

BETTER_AUTH_SECRET=<paste-output-langkah-5.1>
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_COOKIE_DOMAIN=

# Email — kosongkan kalau belum punya akun Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@example.com

# OAuth — kosongkan kalau tidak dipakai
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Payments — DISABLE untuk dev lokal
ENABLE_PAYMENTS=false
POLAR_ACCESS_TOKEN=
POLAR_SUCCESS_URL=http://localhost:3001/success?checkout_id={CHECKOUT_ID}
POLAR_WEBHOOK_SECRET=
POLAR_PRO_PRODUCT_ID=
POLAR_PRO_YEARLY_PRODUCT_ID=
POLAR_STUDIO_PRODUCT_ID=
POLAR_STUDIO_YEARLY_PRODUCT_ID=

# Storage — MinIO lokal
STORAGE_BUCKET=crikket-development
STORAGE_ACCESS_KEY_ID=minioadmin
STORAGE_SECRET_ACCESS_KEY=minioadmin123
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_ADDRESSING_STYLE=path
STORAGE_PUBLIC_URL=

# Optional
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CAPTURE_SUBMIT_TOKEN_SECRET=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

> **Penting:** kalau di langkah 3 Anda pakai port 5432 (bukan 5433), ganti `DATABASE_URL` ke `:5432`.

### 5.3 `apps/web/.env`

```bash
cp apps/web/.env.example apps/web/.env
```

Pastikan isinya:

```ini
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

### 5.4 `apps/extension/.env`

```bash
cp apps/extension/.env.example apps/extension/.env
```

Default sudah benar:

```ini
VITE_APP_URL=http://localhost:3001
VITE_SERVER_URL=http://localhost:3000
```

---

## LANGKAH 6 — Migrasi Database (Push Schema)

```bash
bun run db:push
```

Output sukses akan menampilkan:

```
[✓] Pulling schema from database...
[✓] Changes applied
```

Cek (opsional):

```bash
docker exec crikket-postgres-dev psql -U postgres -d crikket -c "\dt"
```

---

## LANGKAH 7 — Jalankan Semua Service

```bash
bun run dev
```

Tunggu sampai semua service tampil "Ready". Output yang diharapkan:

```
server:dev: Started development server: http://localhost:3000
web:dev:    ✓ Ready in 1.8s
docs:dev:   ✓ Ready in 1.5s
extension:dev: ✔ Started dev server @ http://localhost:5555
```

| Service | URL | Fungsi |
| --- | --- | --- |
| Server | http://localhost:3000 | API Hono + Better Auth |
| Web | http://localhost:3001 | Dashboard (login di sini) |
| Docs | http://localhost:4000 | Dokumentasi |
| Extension WXT | http://localhost:5555 | HMR extension |

> Biarkan terminal ini terbuka. Buka **terminal baru** untuk langkah berikutnya.

---

## LANGKAH 8 — Buat Akun Admin Pertama

### Cara A — Via UI

1. Buka http://localhost:3001
2. Klik **Sign up**, isi email/password.
3. Login.

### Cara B — Via API (lebih cepat)

```bash
curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@crikket.local","password":"Admin12345!","name":"Admin"}'
```

Output sukses: JSON `{"token":"...","user":{...}}`.

### 8.1 Hilangkan banner "email not verified" (opsional)

```bash
docker exec crikket-postgres-dev psql -U postgres -d crikket \
  -c "UPDATE \"user\" SET email_verified = true WHERE email='admin@crikket.local';"
```

Login dengan kredensial:

- **Email:** `admin@crikket.local`
- **Password:** `Admin12345!`

---

## LANGKAH 9 — Build & Install Browser Extension

### 9.1 Build extension

```bash
bun run --filter extension build
```

Output di:

```
apps/extension/.output/chrome-mv3
```

### 9.2 Load di Chrome

1. Buka URL: `chrome://extensions`
2. Aktifkan **Developer mode** (toggle kanan atas).
3. Klik **Load unpacked**.
4. Tekan `Cmd+Shift+G` (macOS) atau `Ctrl+L` (Linux/Win), lalu paste path absolut:

   ```
   /Users/<USERNAME>/crikket/apps/extension/.output/chrome-mv3
   ```

   > Folder `.output` **tersembunyi** karena diawali titik. Di Finder gunakan `Cmd+Shift+.` untuk menampilkan hidden files.

5. Pilih folder `chrome-mv3` (jangan masuk ke dalamnya), klik **Open**.
6. Pin extension Crikket di toolbar (ikon puzzle → pin).

### 9.3 (Opsional) Reload setelah ubah kode

```bash
bun run --filter extension build
```

Lalu di `chrome://extensions` klik tombol reload pada Crikket.

---

## LANGKAH 10 — Tes Record + Upload

1. Buka tab baru (mis. https://example.com).
2. Klik ikon extension Crikket → mulai recording.
3. Lakukan beberapa interaksi.
4. Stop & submit report.
5. Refresh dashboard http://localhost:3001 → report harus muncul, artefak terunduh tanpa error.

Cek file di MinIO:

```bash
docker exec crikket-minio mc ls --recursive local/crikket-development | head
```

Jika muncul object di `bug-reports/...`, upload sukses.

---

## LANGKAH 11 — Stop / Start Kembali

### 11.1 Stop semua

```bash
# Hentikan dev server (Ctrl+C di terminal yang menjalankan `bun run dev`)
# Atau dari terminal lain:
bun run kill:ports

# Hentikan container:
docker stop crikket-postgres-dev crikket-minio
```

### 11.2 Start lagi besok

```bash
docker start crikket-postgres-dev crikket-minio
bun run dev
```

Data Postgres & MinIO **tetap tersimpan** di volume Docker.

### 11.3 Reset total (hapus data)

```bash
docker rm -f crikket-postgres-dev crikket-minio
# Ulangi LANGKAH 3, 4, 6
```

---

## 🛟 Troubleshooting Cepat

| Gejala | Solusi |
| --- | --- |
| `EADDRINUSE :3000` | `bun run kill:ports` lalu ulangi |
| `password authentication failed for user "postgres"` | DB lokal lain yang jawab. Pastikan `DATABASE_URL` pakai port Docker (5433) |
| `Polar customer creation failed (401)` | Set `ENABLE_PAYMENTS=false` di `apps/server/.env`, restart server |
| Upload artifact **403** | `STORAGE_*` belum mengarah ke MinIO. Cek LANGKAH 5.2, restart server |
| Folder `.output` tidak terlihat di Finder | `Cmd+Shift+.` toggle hidden, atau paste path via `Cmd+Shift+G` |
| Email OTP tak masuk | `RESEND_API_KEY` kosong → pakai LANGKAH 8.1 untuk verifikasi manual |
| Extension popup error "Failed to fetch" | `VITE_SERVER_URL` salah / server belum jalan. Build ulang ekstensi setelah edit `.env` |
| `bun install` lambat / gagal | Pastikan koneksi internet stabil, hapus `node_modules` & `bun.lock` lalu ulangi |

---

## 🎯 Verifikasi Final (Acceptance)

Anda dianggap **siap** jika **semua** poin di bawah `✅`:

- [ ] `docker ps` menampilkan `crikket-postgres-dev` dan `crikket-minio` status `Up`.
- [ ] `bun run dev` jalan tanpa error merah, semua app `Ready`.
- [ ] http://localhost:3001 bisa login dengan akun yang dibuat.
- [ ] Tidak ada banner "email not verified" (kalau sudah jalankan LANGKAH 8.1).
- [ ] Section **Install Without Web Store** muncul di dashboard.
- [ ] Extension Crikket terpasang di `chrome://extensions`.
- [ ] Record + upload bug report sukses, file muncul di bucket MinIO.

Selamat — Crikket sudah berjalan penuh di lokal. 🦗
