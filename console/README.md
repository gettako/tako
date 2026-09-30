# Tako Console (`console`)

The Next.js 16 frontend for the Tako self-hosted deployment platform.

## Architecture & Technology Stack

- **Framework**: Next.js 16 (App Router, Server Components & Client Components)
- **Runtime**: React 19
- **Styling**: Tailwind CSS v4 with flat zero-shadow theme
- **UI Primitives**: `@base-ui/react` with shadcn/ui `base-vega` preset
- **Icons**: `@phosphor-icons/react`
- **Package Manager**: Bun (`bun run dev`, `bun run build`)

## UI Rules & Invariants

1. **Base UI Primitives (`@base-ui/react`)**:
   - All UI components use shadcn/ui with `"style": "base-vega"` powered by `@base-ui/react`.
   - **Strictly Prohibited**: Radix UI conventions (such as `asChild` composition) and `@radix-ui/*` packages.
2. **Zero Shadows**:
   - Flat visual hierarchy achieved solely with 1px borders and contrasting color tokens.
   - All box shadows are reset (`0 0 #0000`).
3. **No Direct Hardcoded Mocks**:
   - Data must be consumed strictly through typed API client modules (`lib/api`), switchable via `NEXT_PUBLIC_API_MODE=mock|live`.

## Development Scripts

```bash
# Start development server
bun run dev

# Run TypeScript typecheck
bun run typecheck

# Run ESLint
bun run lint

# Format code
bun run format

# Build production bundle
bun run build
```
