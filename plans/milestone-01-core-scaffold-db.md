# Milestone 01: Core Scaffold & Database Layer

---
- **ID**: `M01`
- **Status**: `todo`
- **Blocking**: `[]`
- **Target**: Membangun fondasi monorepo backend, struktur server Go, koneksi SQLite pure-Go dengan WAL mode, sistem migrasi otomatis dengan Goose (`embed.FS`), generator query type-safe dengan `sqlc`, dan HTTP server Chi dasar.
---

## Acceptance Criteria
- [ ] Server Go berhasil di-build tanpa CGO (`CGO_ENABLED=0`).
- [ ] SQLite terinisialisasi dengan pragmas concurrency: `journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON`, `synchronous=NORMAL`.
- [ ] Goose migrasi schema awal otomatis berjalan saat server pertama kali di-boot melalui `embed.FS`.
- [ ] Schema mencakup tabel utama: `users`, `projects`, `nodes`, `services`, `deployments`, `audit_logs`.
- [ ] `sqlc` berhasil men-generate interface dan queries Go type-safe dari file SQL migrasi.
- [ ] Chi HTTP server aktif di port internal (default `:8080`) dengan endpoint `GET /health` mengembalikan status OK & info database.

## Checklist
- [ ] **Scaffold Go Module**:
  - [ ] Inisialisasi `server/go.mod` dengan modul Go 1.23+
  - [ ] Konfigurasi struktur direktori standard Go: `cmd/server/main.go`, `internal/api/`, `internal/config/`, `internal/store/`, `internal/store/migrations/`
- [ ] **Database Connection & Pragmas**:
  - [ ] Pasang driver pure-Go `modernc.org/sqlite`
  - [ ] Implementasi fungsi `OpenDB(path string) (*sql.DB, error)` dengan konfigurasi WAL dan busy timeout
  - [ ] Unit test koneksi SQLite dan verifikasi pragmas aktif
- [ ] **Goose Migrations**:
  - [ ] Setup `migrations.go` menggunakan `//go:embed migrations/*.sql` dan `pressly/goose/v3`
  - [ ] Buat file migrasi `00001_initial_schema.sql` (tabel `users`, `projects`, `nodes`, `services`, `deployments`, `audit_logs`)
  - [ ] Implementasi auto-migrate saat server start
- [ ] **SQLC Setup**:
  - [ ] Buat file konfigurasi `sqlc.yaml` untuk SQLite & Go engine
  - [ ] Buat query dasar di `internal/store/queries/*.sql` (CRUD nodes, projects, services, deployments)
  - [ ] Jalankan generator `sqlc generate` dan pastikan file Go ter-generate tanpa error
- [ ] **Chi HTTP Server Baseline**:
  - [ ] Setup `chi.NewRouter()` dengan middleware standard: `middleware.RequestID`, `middleware.RealIP`, `middleware.Logger`, `middleware.Recoverer`
  - [ ] Daftarkan endpoint `GET /health` dan `GET /api/v1/ping`
  - [ ] Graceful shutdown server via `os.Signal` (`SIGINT`, `SIGTERM`)
