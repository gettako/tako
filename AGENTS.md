# Tako — Agent Guidelines

Guidelines and engineering standards for AI agents and developers working on the Tako codebase.

---

## 1. Core Principles

- **English Only**: All code, comments, documentation, commit messages, and UI text must be in English.
- **Pragmatic & Minimal (YAGNI)**: Favor simple, direct solutions. Use standard libraries and native features before adding external dependencies or complex abstractions.
- **Preserve Documentation**: Do not remove existing architectural comments, ADR notes, or docstrings unless explicitly instructed.

---

## 2. Design System & UI Guidelines

Tako Console adheres to a **Precision Flat** aesthetic:

- **Zero Shadows**: Never use drop shadows (`box-shadow`, `shadow-sm`, `shadow-lg`, etc.). Visual hierarchy is conveyed strictly through 1px borders (`border-border`), subtle background shifts (`bg-card`, `bg-muted`), and high-contrast typography.
- **Border-Driven Hierarchy**: Containers, cards, tables, popovers, and dialogs are bounded by clean 1px solid borders.
- **Antislop Compliance**:
  - No decorative gradients or AI blur orbs.
  - No em dashes (`—`) in UI copy (use colons, parentheses, or clear layout grouping).
  - No dead buttons or unhandled interactive states.
  - Always provide accessible focus rings (`focus-visible:ring-2 focus-visible:ring-ring`).
- **Component Primitives**:
  - Built with **Base UI** (`@base-ui/react`) and Tailwind CSS v4 using shadcn/ui (`base-vega` style).
  - **Never use Radix UI conventions** (such as `asChild`). Use Base UI's render props or direct children.
  - **Icons**: Use `@phosphor-icons/react` with the standard `Icon` suffix (e.g., `CheckIcon`, `TrashIcon`, `HardDrivesIcon`).
- **Data Fetching**:
  - Never hardcode mock data inside page components.
  - All data must flow through the typed client in `console/lib/api` (`api.*`), switchable via `NEXT_PUBLIC_API_MODE=mock|live`.

---

## 3. Code Style

### Go (`server/` and `agent/`)
- Write idiomatic Go formatted with standard `gofmt`.
- **Explicit Error Handling**: Never silently discard errors (`_ = ...`). Always return errors or wrap them with context (`fmt.Errorf("failed to ...: %w", err)`).
- **Context Propagation**: Always pass `ctx context.Context` as the first argument in I/O and lifecycle functions.
- Respect database migrations (`server/db/migrations/`). Do not alter past executed migrations; create a new numbered `.sql` migration file for schema changes.

### TypeScript & React (`console/`)
- Strict TypeScript: Avoid `any`; use concrete types or types generated from `api/openapi.yaml`.
- Use React Server Components by default; add `"use client"` only when interactive state, effects, or browser APIs are required.
- Merge classes using the `cn(...)` utility.

---

## 4. Linting & Tooling

Always use **Bun** for frontend and monorepo scripts. Never use `npm`, `yarn`, or `pnpm`.

### Frontend (`console/`)
- **Lint**: `bun run lint` (runs `oxlint`) / `bun run lint:fix`
- **Format**: `bun run format` (runs `oxfmt`) / `bun run format:check`
- **Typecheck**: `bun run typecheck` (`tsc --noEmit`)
- **Test**: `NEXT_PUBLIC_API_MODE=mock bun test`

### Backend (`server/` & `agent/`)
- **Lint**: `golangci-lint run`
- **Test**: `go test ./...`

---

## 5. Conventional Commits

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

[optional body]
```

### Types
- `feat`: New feature or user-facing capability
- `fix`: Bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or correcting tests
- `docs`: Documentation changes
- `style`: Formatting, missing semicolons, etc.
- `ci`: CI/CD configuration changes
- `chore`: Maintenance, dependencies, tooling updates

### Scopes (Common Examples)
- `console`: Web UI dashboard
- `server`: API control plane server
- `agent`: Tako agent node daemon
- `deploy`: Docker Compose, installation scripts, Traefik config
- `api`: OpenAPI specifications or shared schemas
- `auth`: Authentication, sessions, permissions
- `github`: GitHub App integration and webhook handling
- `services`: Service provisioning and deployment lifecycle

### Rules
- Subject must be in **lowercase**, **imperative mood** ("add" not "added/adds"), and have **no trailing period**.
- Keep the subject line concise (≤ 72 characters).
- Include a body when explaining the rationale (*why* the change was made) is necessary.
