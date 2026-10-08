# Contributing to Tako

Thank you for your interest in contributing to Tako! Tako is a modern, lightweight, self-hosted Platform-as-a-Service (PaaS) built with Go, Next.js, Docker, gRPC, and Traefik.

Whether you're fixing bugs, adding new features, improving documentation, or optimizing performance, your contributions are warmly welcomed.

---

## Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Please be respectful, constructive, and collaborative in all interactions across issues, pull requests, and discussions.

---

## Repository Structure

Tako is organized as a multi-package repository:

```
gettako/
├── agent/       # Node Worker Daemon in Go (Docker SDK, gRPC client, telemetry)
├── console/     # Management Dashboard in Next.js 16, React 19, Tailwind v4
├── deploy/      # Deployment scripts (install.sh), Dockerfiles, Traefik configs
├── docs/        # Technical documentation (Mintlify MDX) and OpenAPI 3.1 schema
├── plans/       # Architecture plans and milestone specifications
├── proto/       # Protocol Buffers specifications (tako.proto)
└── server/      # Master Orchestrator in Go (Chi router, SQLite WAL, gRPC server, SSE)
```

---

## Prerequisites

Before setting up Tako locally, ensure you have the following installed:

- **Go**: Version 1.24+ (Go 1.27 recommended)
- **Node.js**: Version 20+ (LTS) & `npm`
- **Docker**: Version 24+ & Docker Compose v2
- **Protobuf Compiler** (*optional, only needed when updating `.proto`*):
  - `protoc`
  - `protoc-gen-go` (`go install google.golang.org/protobuf/cmd/protoc-gen-go@latest`)
  - `protoc-gen-go-grpc` (`go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest`)

---

## Local Development Setup

### 1. Fork and Clone the Repository

```bash
git clone https://github.com/your-username/gettako.git
cd gettako
```

### 2. Running the Master Server

The Master Server orchestrates deployments, manages SQLite databases, and listens for HTTP and gRPC connections:

```bash
cd server
cp .env.example .env # adjust variables if needed
go run ./cmd/server
```

By default:
- HTTP API & Console BFF listen on port `8080`.
- gRPC Orchestrator listens on port `9090`.

### 3. Running the Worker Agent

The Agent daemon connects to the Master Server via outbound gRPC and controls the local Docker engine:

```bash
cd agent
cp .env.example .env # set TAKO_SERVER_ADDR=localhost:9090
go run ./cmd/agent
```

### 4. Running the Web Console

The Console is a Next.js 16 application with React 19 and Tailwind CSS v4:

```bash
cd console
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Compiling Protocol Buffers

If you make modifications to [proto/tako.proto](file:///Users/SupianIDz/Work/gettako/proto/tako.proto), regenerate the Go stubs:

```bash
protoc --go_out=. --go_opt=paths=source_relative \
       --go-grpc_out=. --go-grpc_opt=paths=source_relative \
       proto/tako.proto
```

---

## Coding Standards

### Go (`server/` and `agent/`)
- Always format code with `gofmt` or `goimports`.
- Follow standard Go error handling: do not ignore returned errors.
- Wrap errors with contextual information using `fmt.Errorf("action description: %w", err)`.
- Use Go concurrency primitives (`sync.Mutex`, channels, `context.Context`) cleanly and avoid leaking goroutines.
- Write unit tests for business logic (`*_test.go`).

### TypeScript & React (`console/`)
- Strictly type props, API responses, and state hooks. Avoid using `any`.
- Keep components focused and reusable.
- Use Tailwind CSS v4 utility classes adhering to the Tako design system palette (`#432DD7` primary).
- Ensure components render properly in dark and light modes.
- Avoid client-side waterfalls; leverage React 19 Server Components where appropriate.

### Markdown & Documentation (`docs/`, `README.md`)
- Keep documentation up to date with real codebase implementations.
- Use Mermaid diagrams for architecture representations instead of plain ASCII art.
- Write documentation strictly in **English**.

---

## Git Commit Guidelines

We adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description in imperative mood>

[optional body]

[optional footer]
```

### Types:
- `feat`: A new feature or capability
- `fix`: A bug fix
- `docs`: Documentation updates or additions
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or correcting tests
- `chore`: Tooling, build pipeline, or dependency updates

### Examples:
- `feat(server): implement webauthn passkey registration`
- `fix(agent): handle container stop timeout gracefully`
- `docs(traefik): document dynamic acme certificate storage`
- `refactor(console): streamline service status badge component`

---

## Submitting a Pull Request (PR)

1. **Create a branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. **Make your changes** and verify tests pass:
   ```bash
   # Server tests
   cd server && go test -v ./...

   # Agent tests
   cd ../agent && go test -v ./...

   # Console check
   cd ../console && npm run build
   ```
3. **Commit your changes** using conventional commit messages.
4. **Push your branch** to your fork:
   ```bash
   git push origin feat/your-feature-name
   ```
5. **Open a Pull Request** against the `main` branch of `gettako/gettako`.
6. Fill out the PR template describing the problem solved, your approach, and testing performed.

Thank you for helping make Tako better for everyone!
