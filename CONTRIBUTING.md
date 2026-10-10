# Contributing to Tako

Thank you for your interest in contributing to Tako.

Tako is an open-source, self-hosted deployment platform built with Go, Next.js, Docker, gRPC, and Traefik v3.

---

## Code of Conduct

Be constructive, respectful, and collaborative across all issues, pull requests, and discussions.

---

## Repository Structure

```
gettako/
├── agent/       # Node daemon in Go (Docker Engine SDK, gRPC client, host telemetry)
├── api/         # OpenAPI 3.1 specification (openapi.yaml) & Protocol Buffers (proto/)
├── console/     # Next.js 16 dashboard (React 19, Tailwind CSS v4)
├── deploy/      # Installer scripts (install.sh), Compose definitions, Traefik configuration
├── docs/        # Mintlify MDX documentation and synced OpenAPI specifications
└── server/      # Master orchestrator in Go (Chi HTTP router, SQLite WAL, gRPC server)
```

---

## Prerequisites

- **Go**: Version 1.24+
- **Node.js**: Version 20+ (LTS) & `npm`
- **Docker**: Version 24+ & Docker Compose v2
- **Protocol Buffer Tools** (*only needed when modifying `.proto`*):
  - `protoc`
  - `protoc-gen-go` (`go install google.golang.org/protobuf/cmd/protoc-gen-go@latest`)
  - `protoc-gen-go-grpc` (`go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest`)

---

## Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/gettako/tako.git
cd tako
```

### 2. Run Master Server

```bash
cd server
cp .env.example .env
go run ./cmd/server
```

- REST API & SSE Hub listen on port `8080`.
- gRPC Orchestrator listens on port `50051`.

### 3. Run Node Agent

In a separate terminal:

```bash
cd agent
cp .env.example .env
go run ./cmd/agent
```

### 4. Run Web Console

In a separate terminal:

```bash
cd console
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the console.

### 5. Compile Protocol Buffers (When Modifying `.proto`)

```bash
cd api/proto
protoc --go_out=. --go_opt=paths=source_relative \
       --go-grpc_out=. --go-grpc_opt=paths=source_relative \
       tako/v1/*.proto
```

### 6. Validate OpenAPI Specification & Endpoints

When modifying API routes in `server/internal/api/`, ensure all routes are documented in `api/openapi.yaml` and synchronize the docs:

```bash
# Verify all endpoints are documented
cd server
go test -v -run TestAllServerEndpointsDocumentedInOpenAPI ./internal/api/...

# Sync specification to documentation
cp ../api/openapi.yaml ../docs/api-reference/openapi.yaml
cp ../api/openapi.yaml ../docs/openapi.yaml
```

---

## Coding Standards

### Go (`server/` and `agent/`)
- Format code with standard `gofmt` or `goimports`.
- Do not ignore errors. Wrap errors with clear context using `fmt.Errorf("action description: %w", err)`.
- Use Go concurrency primitives (`sync.Mutex`, channels, `context.Context`) cleanly without leaking goroutines.
- Write unit tests for new logic (`*_test.go`).

### TypeScript & React (`console/`)
- Strictly type props, API responses, and hooks. Avoid `any`.
- Keep components focused and reusable.
- Use Tailwind CSS v4 utilities according to the design system palette.
- Verify components render cleanly in dark and light modes.

### Documentation (`docs/`, `README.md`)
- Keep documentation synchronized with active codebase implementations.
- Write documentation in clear English.
- Avoid promotional fluff, empty buzzwords, and unsubstantiated claims.

---

## Git Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description in imperative mood>

[optional body]

[optional footer]
```

### Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation updates
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or correcting tests
- `chore`: Tooling, build pipeline, or dependency updates

---

## Submitting a Pull Request

1. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Verify all tests pass locally:
   ```bash
   # Server tests and OpenAPI endpoint coverage
   cd server && go test -v ./...

   # Agent tests
   cd ../agent && go test -v ./...

   # Console build check
   cd ../console && npm run build
   ```
3. Commit your changes using conventional commit messages.
4. Push your branch and open a Pull Request against `main`.
