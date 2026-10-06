<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):
- Core filter, always on: `antislop`: `.agents/skills/antislop/SKILL.md`
- UI / visual: `antislop-ui`: `.agents/skills/antislop-ui/SKILL.md`
- Copy & text: `antislop-copywriting`: `.agents/skills/antislop-copywriting/SKILL.md`
- People: `antislop-human`: `.agents/skills/antislop-human/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.agents/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `antislop-code`: `.agents/skills/antislop-code/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->

## UI & Design System Guidelines

Whenever working on UI, layouts, styles, or components, you MUST strictly adhere to the following rules:

### 1. Mandatory Compliance with `DESIGN.md`
- Always follow the tokens, layout specifications, and style guide defined in [`DESIGN.md`](./DESIGN.md).
- Adhere strictly to the **`base-vega`** style defined in [`components.json`](./components.json) and [`app/globals.css`](./app/globals.css):
  - **Colors:** Use semantic tokens (`primary`, `secondary`, `muted`, `accent`, `border`, `destructive`). The primary accent is Electric Indigo (`#432DD7` / `oklch(0.457 0.24 277.023)`). Never use arbitrary hardcoded hex or raw Tailwind colors (e.g., avoid `bg-blue-500`, `text-gray-900`).
  - **Radii:** Adhere to the `--radius` scale (base 10px / `0.625rem`). Standard interactive controls (buttons, inputs) must use 8px (`rounded-md` / `calc(var(--radius) * 0.8)`). Small elements use 6px (`rounded-sm`), and containers use 10px–18px (`rounded-lg`–`rounded-2xl`).
  - **Heights & Sizing:** Standardize interactive elements on 36px (`h-9`), with 24px (`h-6`, xs), 32px (`h-8`, sm), and 40px (`h-10`, lg) variants.
  - **Spacing & Gaps:** Use `gap-1` (4px) for compact items and `gap-1.5` (6px) between icons and labels in standard controls.
  - **Typography:** Use `Inter` for sans text/headings and `Geist Mono` for technical/code elements.

### 2. Reference the `shadcn` Skill
- For any UI implementation or modification, always consult the installed `shadcn` skill at [`.agents/skills/shadcn/SKILL.md`](./.agents/skills/shadcn/SKILL.md).
- Follow all shadcn composition patterns (e.g., proper slot composition, full Card structure with Header/Title/Content/Footer, avoiding `space-x-*`/`space-y-*` in favor of `flex flex-col gap-*`).

### 3. Always Use shadcn Components via CLI
- Always install official shadcn components using the bun package runner:
  ```bash
  bunx --bun shadcn@latest add <component-name>
  ```
  *(Example: `bunx --bun shadcn@latest add card`, `bunx --bun shadcn@latest add dialog`, `bunx --bun shadcn@latest add input`)*
- Never re-implement or handcraft components that already exist in the shadcn registry. Always search and install first.

### 4. Custom Components Fallback
- Creating custom UI components from scratch is permitted **only as a last resort** if a required component does not exist in the shadcn registry or cannot be composed from existing primitives.
- When creating custom components, they MUST strictly conform to the `base-vega` design language and tokens in `DESIGN.md`:
  - Built with `@base-ui/react` primitives where applicable.
  - Styled exclusively with semantic Tailwind CSS variables.
  - Incorporate the tactile interaction pattern (`active:not-aria-[haspopup]:translate-y-px`) and accessibility focus rings (`focus-visible:ring-3 focus-visible:ring-ring/50`).

### 5. Tako Extensions & Project Conventions
- `DESIGN.md` → "Tako Extensions" overrides Base Vega where they conflict.
- **Status colors** are semantic only: emerald = success/online, red = danger/offline, blue = info/running/deploying, amber = warning/degraded, neutral gray = stopped/queued/skipped. Use the `StatusBadge` / `--status-*` tokens.
- **Blue is status-only.** Buttons, active nav, links and focus rings use the indigo primary.
- **Chart palette:** CPU indigo, RAM emerald, Network blue, Disk amber. Never red for a normal series.
- **UI-only scope:** no real backend. All data comes from typed async functions in `lib/api/*` over in-memory mocks in `lib/mock/*`; domain types live in `lib/types/*` and are the future Go API contract. Data is fetched with TanStack Query.
- **Ponytail discipline:** simplest thing that works. YAGNI, stdlib/native platform first, no speculative abstractions, no new dependency if a few lines do the job.
