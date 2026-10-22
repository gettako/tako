<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Tako Agent Guidelines

## 1. Project Overview

Tako is a specialized self-hosted edge infrastructure and real-time agent telemetry platform designed for systems engineers and platform teams.

### Tech Stack

- **Runtime & Package Manager:** Bun (`bun`, `bunx`)
- **Framework:** Next.js 16 (App Router), React 19 (Server and Client Components)
- **Language:** TypeScript 5+ (strict mode)
- **Styling:** Tailwind CSS v4 (`@theme inline`), CSS Variables with OKLCH color space
- **Component Primitives:** shadcn `base-vega` style, Base UI (`@base-ui/react`), Lucide React icons
- **Animations:** Motion (`motion/react`), `tw-animate-css`
- **Tooling:** Oxlint (linter), Oxfmt (formatter), TypeScript (`tsc --noEmit`)

---

## 2. Language Requirement

- **Agent Communication & Responses:** Always respond in the language used by the developer (e.g., if the user communicates in Indonesian, reply in Indonesian; if in English, reply in English).
- **Code & Comments:** Always use English for all code, code comments, variable/type/function names, commit messages, and technical documentation.
- **User Interface:** Maintain English for UI labels, telemetry metrics, and platform text by default unless localized strings are explicitly requested.

---

## 3. Design System & Visual Routing

For any UI, visual, layout, or copywriting task:

1. **Read `DESIGN.md` first:** Consult [DESIGN.md](file:///Users/SupianIDz/Work/gettako/tako/DESIGN.md) for identity, visual tokens (colors, typography, rounded scales, spacing), and component definitions.
2. **Token Source of Truth:** `DESIGN.md` adheres to the Google Labs `design.md` specification. Validate changes using:
   ```bash
   bunx @google/design.md lint DESIGN.md
   ```
3. **Styling Integration:** Styles are declared in [app/globals.css](file:///Users/SupianIDz/Work/gettako/tako/app/globals.css) and configured via [components.json](file:///Users/SupianIDz/Work/gettako/tako/components.json).
4. **Visual Calibration:** Follow the declared dials: **ENERGY: 2**, **RHYTHM: 2**, **MOTION: 1**. Keep designs utilitarian, data-dense, and technically focused without decorative AI clutter.

---

## 4. Code Search (XERJ)

This project uses XERJ for reference coding. Before writing code that touches unfamiliar territory:

- `xerj def "<symbol>"` for go-to-definition.
- `xerj search "<plain words>"` for ranked, definition-first passages.
- `xerj autoindex <folder>` to reindex if needed.
- Cite `file:line` for reference implementations.

---

## 5. Development & Verification Workflow

Always use `bun` as the package manager and test runner. Verify your changes before declaring completion:

- **Install:** `bun install` or `bun add <package>`
- **Lint:** `bun run lint` (uses Oxlint; ensure 0 errors and 0 warnings)
- **Typecheck:** `bun run typecheck` (`tsc --noEmit`)
- **Format:** `bun run format` (uses Oxfmt)
- **Dev Server:** `bun run dev`
- **Build:** `bun run build`

---

## 6. Engineering Conventions & Quality Gates

- **Functional Completeness:** Every interactive button, toggle, and link must have working logic. Do not ship dead controls or links to non-existent routes.
- **Accessibility:** Ensure all text passes WCAG AA contrast standards (minimum 4.5:1 for normal text). Support logical keyboard navigation (`Tab`, `Enter`, `Escape`) with visible focus rings.
- **Resilient States:** Every data-driven UI must account for empty, loading, and error states.
- **Honest Content:** Use real data or explicit honest placeholders (e.g. `[LIVE METRIC]`, `[REAL DATA]`). Never invent fake statistics or fictional user testimonials.
- **Preserve Comments:** Maintain existing relevant comments and avoid injecting unnecessary AI commentary.

<!-- antislop:start -->

## antislop

For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):

- Core filter, always on: `antislop`: `.agents/skills/antislop/SKILL.md`
- UI / visual: `antislop-ui`: `.agents/skills/antislop-ui/SKILL.md`
- Copy & text: `antislop-copywriting`: `.agents/skills/antislop-copywriting/SKILL.md`
- People: `antislop-human`: `.agents/skills/antislop-human/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.agents/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `antislop-code`: `.agents/skills/antislop-code/SKILL.md`
  Mode preference: When resolving antislop mode, always choose **DURING** (`during`). Apply antislop rules during planning and execution so AI slop is prevented from the start, without stopping to ask. Announce `antislop active: during (global preference).` before presenting findings or making edits.
  To update antislop later: `bunx antislop-ai --update`, or run `bunx antislop-ai` and pick Overwrite them.

<!-- antislop:end -->
