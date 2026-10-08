# Milestone 01: Core Scaffold & Database Layer

---
- **ID**: `M01`
- **Status**: `completed`
- **Blocking**: `[]`
- **Target**: Build monorepo backend foundation, Go server structure, pure-Go SQLite connection in WAL mode, automatic migration system with Goose (`embed.FS`), type-safe query generation with `sqlc`, and baseline Chi HTTP server.
---

## Acceptance Criteria
- [x] Go server builds successfully without CGO (`CGO_ENABLED=0`).
- [x] SQLite initializes with concurrency pragmas: `journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON`, `synchronous=NORMAL`.
- [x] Goose initial schema migrations run automatically during server startup via `embed.FS`.
- [x] Schema covers core tables: `users`, `projects`, `nodes`, `services`, `deployments`, `audit_logs`.
- [x] `sqlc` generates type-safe Go queries and interfaces from migration SQL files.
- [x] Chi HTTP server active on internal port (default `:8080`) with `GET /health` returning OK and database connectivity status.

## Checklist
- [x] **Scaffold Go Module**:
  - [x] Initialize `server/go.mod` with Go 1.27.1 module (`gettako.dev/tako`)
  - [x] Configure standard Go directory structure: `cmd/server/main.go`, `internal/api/`, `internal/config/`, `internal/store/`, `internal/store/migrations/`
- [x] **Database Connection & Pragmas**:
  - [x] Install pure-Go driver `modernc.org/sqlite`
  - [x] Implement `OpenDB(path string) (*sql.DB, error)` with WAL and busy timeout configuration
  - [x] Unit test SQLite connection and verify active pragmas
- [x] **Goose Migrations**:
  - [x] Setup `migrations.go` using `//go:embed migrations/*.sql` and `pressly/goose/v3`
  - [x] Create migration `00001_initial_schema.sql` (`users`, `projects`, `nodes`, `services`, `deployments`, `audit_logs`)
  - [x] Implement auto-migrate during server boot
- [x] **SQLC Setup**:
  - [x] Create `sqlc.yaml` configuration for SQLite & Go engine
  - [x] Define queries in `internal/store/queries/*.sql` (CRUD for nodes, projects, services, deployments)
  - [x] Run `sqlc generate` and verify generated Go code
- [x] **Chi HTTP Server Baseline**:
  - [x] Setup `chi.NewRouter()` with standard middleware: `middleware.RequestID`, `middleware.RealIP`, `middleware.Logger`, `middleware.Recoverer`
  - [x] Register endpoints `GET /health` and `GET /api/v1/ping`
  - [x] Graceful shutdown handling via `os.Signal` (`SIGINT`, `SIGTERM`)
