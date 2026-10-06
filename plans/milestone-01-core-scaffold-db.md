# Milestone 01: Core Scaffold & Database Layer

---
- **ID**: `M01`
- **Status**: `completed`
- **Blocking**: `[]`
- **Target**: Membangun fondasi monorepo backend, struktur server Go, koneksi SQLite pure-Go dengan WAL mode, sistem migrasi otomatis dengan Goose (`embed.FS`), generator query type-safe dengan `sqlc`, dan HTTP server Chi dasar.
---

## Acceptance Criteria
- [x] Server Go berhasil di-build tanpa CGO (`CGO_ENABLED=0`).
- [x] SQLite terinisialisasi dengan pragmas concurrency: `journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON`, `synchronous=NORMAL`.
- [x] Goose migrasi schema awal otomatis berjalan saat server pertama kali di-boot melalui `embed.FS`.
- [x] Schema mencakup tabel utama: `users`, `projects`, `nodes`, `services`, `deployments`, `audit_logs`.
- [x] `sqlc` berhasil men-generate interface dan queries Go type-safe dari file SQL migrasi.
- [x] Chi HTTP server aktif di port internal (default `:8080`) dengan endpoint `GET /health` mengembalikan status OK & info database.

## Checklist
- [x] **Scaffold Go Module**:
  - [x] Inisialisasi `server/go.mod` dengan modul Go 1.27.1 (`gettako.dev/tako`)
  - [x] Konfigurasi struktur direktori standard Go: `cmd/server/main.go`, `internal/api/`, `internal/config/`, `internal/store/`, `internal/store/migrations/`
- [x] **Database Connection & Pragmas**:
  - [x] Pasang driver pure-Go `modernc.org/sqlite`
  - [x] Implementasi fungsi `OpenDB(path string) (*sql.DB, error)` dengan konfigurasi WAL dan busy timeout
  - [x] Unit test koneksi SQLite dan verifikasi pragmas aktif
- [x] **Goose Migrations**:
  - [x] Setup `migrations.go` menggunakan `//go:embed migrations/*.sql` dan `pressly/goose/v3`
  - [x] Buat file migrasi `00001_initial_schema.sql` (tabel `users`, `projects`, `nodes`, `services`, `deployments`, `audit_logs`)
  - [x] Implementasi auto-migrate saat server start
- [x] **SQLC Setup**:
  - [x] Buat file konfigurasi `sqlc.yaml` untuk SQLite & Go engine
  - [x] Buat query dasar di `internal/store/queries/*.sql` (CRUD nodes, projects, services, deployments)
  - [x] Jalankan generator `sqlc generate` dan pastikan file Go ter-generate tanpa error
- [x] **Chi HTTP Server Baseline**:
  - [x] Setup `chi.NewRouter()` dengan middleware standard: `middleware.RequestID`, `middleware.RealIP`, `middleware.Logger`, `middleware.Recoverer`
  - [x] Daftarkan endpoint `GET /health` dan `GET /api/v1/ping`
  - [x] Graceful shutdown server via `os.Signal` (`SIGINT`, `SIGTERM`)
