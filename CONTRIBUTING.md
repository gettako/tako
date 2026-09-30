# Contributing to Tako

Thank you for your interest in contributing to Tako, the self-hosted platform for auto-deploying applications.

---

## Getting Started

### Prerequisites

- Go 1.24 or newer
- Bun (latest version)
- Docker Engine 24.0+ and Docker Compose v2

### Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/gettako/tako.git
cd tako

# 2. Install console dependencies
bun install

# 3. Start console dashboard
bun run --filter console dev

# 4. Start Go control plane
go run ./server
```

---

## Architectural Rules

Before submitting code, keep these core rules in mind:

- **UI Guidelines**: Components use shadcn/ui (`base-vega` on `@base-ui/react`) and Tailwind CSS 4. Zero drop shadows. Never use Radix conventions such as `asChild`.
- **API First**: Components strictly consume typed data from `console/lib/api`. Update `api/openapi.yaml` and regenerate types (`bun run --filter console api:generate`) before introducing new API properties.
- **English Only**: All documents, comments, commit messages, and UI text must be in English.
- **Package Manager**: Use `bun` exclusively for frontend work (`bun install`, `bun run dev`, `bun run build`). Never use `npm`, `pnpm`, or `yarn`.

---

## Development Workflow

### Branching

| Type | Pattern | Example |
| :--- | :--- | :--- |
| New feature | `feat/<description>` | `feat/github-webhook-trigger` |
| Bug fix | `fix/<description>` | `fix/grpc-reconnect-backoff` |
| UI change | `ui/<description>` | `ui/deployment-log-viewer` |
| Refactor | `refactor/<description>` | `refactor/container-retention` |

### Verification Checks

Run the following checks before opening a pull request:

```bash
# Console typecheck and lint
bun run --filter console typecheck
bun run --filter console lint

# Go tests
go test ./...
```
