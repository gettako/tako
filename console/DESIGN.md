---
version: 2.0.0
name: Tako Design System (Flat Architecture & Zero Shadow)
description: Precision PaaS design system featuring an uncompromisingly flat, border-governed architecture. Canvas, cards, and modal surfaces share identical background tones (#FFFFFF in light, #0B0C14 in dark) with zero drop shadows, relying entirely on high-contrast, WCAG 2.1 AA/AAA-compliant hairline borders and typography.
modes:
  light:
    primary: "#432DD7"
    secondary: "#F4F4F5"
    tertiary: "#6366F1"
    neutral: "#525866"
    surface: "#FFFFFF"
    background: "#FFFFFF"
    outline: "#E2E4E9"
    error: "#EF4444"
  dark:
    primary: "#5B63D3"
    primary-60: "#98A4F7"
    primary-70: "#7D87E8"
    secondary: "#0B0C14"
    tertiary: "#FFFFFF"
    neutral: "#0B0C14"
    surface: "#0B0C14"
    on-surface: "#FFFFFF"
    muted: "#939DB81A"
    border: "rgba(255, 255, 255, 0.12)"
    accent-glow: "none"
    error: "#FF5A6A"
typography:
  display:
    fontFamily: Inter
    fontSize: 3rem
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.025em
  h1:
    fontFamily: Inter
    fontSize: 2.25rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 1.875rem
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.015em
  h3:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.01em
  h4:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.35
  body-xl:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: 400
    lineHeight: 1.5
  body-lg:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.43
  caption:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.33
  label-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 500
    lineHeight: 1
  label-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1
  label-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1
  code:
    fontFamily: Geist Mono
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: 0px
  xs: 4px
  sm: 6px
  md: 8px
  lg: 10px
  xl: 14px
  2xl: 18px
  3xl: 22px
  4xl: 26px
  full: 9999px
spacing:
  3xs: 1px
  2xs: 2px
  xs: 4px
  sm: 6px
  md: 8px
  lg: 10px
  xl: 12px
  2xl: 16px
  3xl: 20px
  4xl: 24px
  5xl: 32px
  6xl: 48px
  7xl: 64px
---

# Tako Design System

## Overview

Modern, precise, and engineered. The **Tako Design System** defines the visual language and component architecture for the Tako PaaS console, built on top of headless `@base-ui/react` primitives and Tailwind CSS v4.

The system uses a tailored dual-theme architecture:
1. **Light Mode (Base Vega Flat):** Clean, crisp, high-clarity interface where the canvas, cards, dialogs, and popovers share the exact same pure white (`#FFFFFF`) surface, paired with electric indigo (`#432DD7`) accents, soft slate secondary typography (`#64748B`), and subtle hairline borders (`#E2E4E9`).
2. **Dark Mode (Better Stack Dark Flat):** A sleek dark SaaS environment where the canvas, cards, dialogs, and popovers share the exact same obsidian neutral canvas (`#0B0C14`), with zero drop shadows, crisp blue-violet CTAs (`#5B63D3`), muted slate supportive typography (`#939DB8`), and refined hairline borders (`rgba(255, 255, 255, 0.12)`).

---

## Colors

### Light Mode (Base Vega Flat)

Rooted in a pure `#FFFFFF` background with high clarity and balance:

- **Background (#FFFFFF):** Primary canvas background.
- **Surface / Card / Popover (#FFFFFF):** Pure white container fill identical to the main background canvas.
- **Primary (#432DD7):** Electric Indigo (`oklch(0.457 0.24 277.023)`). Central action driver for interactive controls, focus rings, and primary highlights (8.09:1 contrast). Paired with white text (`#FFFFFF`, 8.09:1 contrast).
- **Secondary (#F4F4F5):** Subtle cool slate. Used for secondary button fills.
- **Tertiary (#6366F1):** Vivid indigo accent for hover shifts and secondary emphasis.
- **Neutral / Muted Foreground (#64748B):** Soft slate gray with 4.60:1 contrast against `#FFFFFF`, passing WCAG AA without visual fatigue.
- **Outline / Border (#E2E4E9):** Subtle, clean hairline border providing crisp container separation without harsh contrast.
- **Error (#EF4444):** Standard alert red (WCAG AA).

### Dark Mode (Better Stack Dark Flat)

Derived from developer-centric telemetry and cloud infrastructure clarity:

- **Neutral / Background / Card / Popover (#0B0C14):** The unified obsidian near-black base background shared by canvas, cards, popovers, and sidebars.
- **On-Surface / Tertiary (#FFFFFF):** Pure white for hero headlines, card titles, key controls, and maximal contrast.
- **Primary (#5B63D3):** A blue-violet action color used for primary conversion CTAs, active sidebar tabs, and interactive highlights.
- **Primary-70 (#7D87E8):** A mid-luminosity blue-violet variant used for primary button hover states and active emphasis.
- **Primary-60 (#98A4F7):** A lighter lavender-blue used for links, step indicators, and secondary highlights.
- **Secondary / Muted Foreground (#939DB8):** A muted slate-blue-gray used for supportive text, descriptions, table headers, and metadata.
- **Muted (#939DB81A / `rgba(147, 157, 184, 0.10)`):** A translucent slate fill tone used for quiet buttons and subtle badge fills.
- **Border (`rgba(255, 255, 255, 0.12)`):** A refined, sleek hairline border providing subtle component definition without harsh white glare.
- **Accent Glow:** Removed (`none`). Interface relies strictly on flat hairline borders.
- **Error (#FF5A6A):** Vivid alert coral red with 6.43:1 contrast against `#0B0C14` (WCAG AA).

---

## Typography

Typography pairs **Inter** as the primary interface typeface with **Geist Mono** for code, logs, and telemetry data.

- **Headlines:** Set in Inter with medium weights (500/600) rather than heavy bold, preserving a refined, technical Swiss feel. Tracking is slightly tightened (`-0.02em` to `-0.025em`) for display sizes.
- **Body:** Inter Regular (400) at 14px (`body-sm`) for compact UI layouts and 16px (`body-md`) for editorial clarity with relaxed 1.43–1.5 line heights.
- **Labels:** Inter Medium (500) at 12px (`label-sm`), 14px (`label-md`), and 16px (`label-lg`), optimized for button text, badge status, navigation tabs, and form labels.
- **Monospace:** Geist Mono Regular (400) at 13px–14px for API keys, JSON payloads, terminal output, git commits, and numerical telemetry.

---

## Layout

Layout adheres to an 8pt base grid system augmented by 2px and 4px micro-steps for compact interface components.

- **Standard Component Heights:**
  - Extra Small (`xs`): 24px (`h-6`)
  - Small (`sm`): 32px (`h-8`)
  - Default: 36px (`h-9`)
  - Large (`lg`): 40px (`h-10`)
  - Hero CTA: 50px (marketing / primary landing actions)
- **Internal Gaps:**
  - `gap-1` (4px): Used in compact components (`xs`, `sm`) between icons and labels.
  - `gap-1.5` (6px): Standard gap in `default` and `lg` buttons between icons and labels.
- **Horizontal Padding:**
  - `px-2` (8px): Extra small controls (`xs`).
  - `px-2.5` (10px): Standard padding for `sm`, `default`, and `lg` buttons.

---

## Elevation & Depth (Flat Architecture)

The UI is strictly flat. Drop shadows and elevation lifts are completely eliminated (`--shadow-*: none`). Structural hierarchy comes purely from:
1. **WCAG-Compliant Hairline Borders:** 1px hairline borders (`border-border`) clearly demarcate cards, tables, inputs, and modal dialogs from the canvas.
2. **Unified Canvas Tone:** Cards, popovers, drawers, and background share the exact same background color (`#FFFFFF` in light, `#0B0C14` in dark).
3. **Tactile Interaction:** Interactive buttons feature a subtle 1px vertical translation on click (`active:not-aria-[haspopup]:translate-y-px`) and border emphasis on hover.
4. **Focus Rings:** Accessibility rings utilize a 3px ring (`focus-visible:ring-3 focus-visible:ring-ring/50`) without layout shift.

---

## Shapes

The shape hierarchy is derived from a 10px base radius (`--radius: 0.625rem`):

- **Small (`4px` / `radius-xs`):** Minor tags, indicators, and secondary button corners.
- **Medium (`8px`–`10px` / `radius-md`): Default corner radius for buttons, inputs, selects, and dropdown list items.
- **Large (`10px`–`12px` / `radius-lg`): Default cards, dialog modals, and dropdown popovers.
- **2XL / 4XL (`18px`–`26px`): Presentation panels, hero containers, and major dashboard cards.
- **Full (`9999px`):** Status badges, chips, user avatars, and circular action buttons.

---

## Components

Components are built on `@base-ui/react` primitives and styled with Tailwind CSS v4 class utilities:

### Buttons

- **Primary (`variant="default"`):**
  - Light: Solid electric indigo (`bg-primary text-primary-foreground hover:bg-primary/90`).
  - Dark (BTS): Solid blue-violet (`bg-[#5B63D3] text-white hover:bg-[#7D87E8]`).
- **Secondary (`variant="secondary"`):**
  - Light: Soft slate background (`bg-secondary text-secondary-foreground`).
  - Dark (BTS): Surface tone with border (`dark:border dark:border-border dark:bg-card dark:hover:bg-muted/40 dark:text-foreground`).
- **Outline (`variant="outline"`):**
  - Light: Bordered canvas (`border-border bg-background hover:bg-muted`).
  - Dark (BTS): Transparent background with border (`dark:border-border dark:bg-transparent dark:hover:bg-muted dark:hover:text-foreground`).
- **Ghost (`variant="ghost"`):**
  - Transparent background with muted hover fill (`hover:bg-muted hover:text-foreground`).
- **Destructive (`variant="destructive"`):**
  - Light: `bg-destructive/10 text-destructive hover:bg-destructive/20`.
  - Dark (BTS): `dark:bg-destructive/20 dark:text-[#FF5A6A] dark:hover:bg-destructive/30`.
- **Link (`variant="link"`):**
  - Light: `text-primary hover:underline`.
  - Dark (BTS): `dark:text-[#98A4F7] dark:hover:text-[#98A4F7]/80 hover:underline`.

### Form Controls & Inputs

- Inputs and textareas match standard button heights (36px default) and corner radii (8px–10px / `rounded-md`).
- Flat, zero-shadow borders (`border-border`) ensure high visibility against the unified background.

### Cards & Panels

- Container padding follows the 8pt rhythm (`p-6` standard, `p-5` for stat cards).
- All cards share the same background color as the canvas (`bg-card` = `bg-background`).
- Separation is achieved entirely via high-contrast hairline borders (`border border-border`).

---

## Do's and Don'ts

- **Do** keep both light mode and dark mode completely flat with zero drop shadows.
- **Do** ensure cards, containers, popovers, and the main background share the exact same background color.
- **Do** rely exclusively on crisp 1px borders (`border-border`) for containment and visual separation.
- **Do** maintain all color tokens strictly above WCAG 2.1 AA thresholds (>= 4.5:1 for text, >= 3.0:1 for borders/controls).
- **Don't** add drop shadows, inner box-shadows, or artificial glow effects.
- **Don't** use faint, low-contrast borders (e.g., opacity under 0.35 in dark mode or lighter than `#808080` in light mode) that fail WCAG 1.4.11.

---

## shadcn base-vega Rules & Architecture

Tako is built strictly upon the **shadcn `base-vega`** style preset (`components.json`), powered by headless `@base-ui/react` primitives and Tailwind CSS v4. All layouts, views, and components must adhere to the following composition and engineering rules:

### 1. Preset & Foundation
- **Style Preset:** `base-vega` (configured in `components.json`).
- **Primitives Library:** `@base-ui/react` (un-styled, accessible headless primitives by MUI/Floating UI team).
- **Styling Architecture:** Exclusively driven by semantic Tailwind CSS variables (`--primary`, `--secondary`, `--muted`, `--accent`, `--border`, `--destructive`, `--status-*`, `--chart-*`). Arbitrary hardcoded colors (e.g. `bg-blue-500`, `text-gray-900`, raw hex strings) are strictly prohibited.
- **Base Scale:**
  - Base radius: `--radius: 0.625rem` (10px).
  - Standard controls: 8px (`rounded-md` / `calc(var(--radius) * 0.8)`).
  - Small elements: 6px (`rounded-sm` / `calc(var(--radius) * 0.6)`).
  - Cards & popovers: 10px–14px (`rounded-lg`–`rounded-xl`).
  - Hero containers: 18px (`rounded-2xl`).
  - Standard interactive height: 36px (`h-9`), with `h-8` (`sm`) and `h-10` (`lg`).
  - Internal gaps: `gap-1.5` (6px) for standard/large controls, `gap-1` (4px) for compact (`sm`/`xs`) controls.

### 2. Card Composition (`data-slot`)
- **Slot Composition:** Always utilize the canonical slot hierarchy:
  ```tsx
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
      <CardAction>{actionButton}</CardAction>
    </CardHeader>
    <CardContent>{content}</CardContent>
    <CardFooter>{footer}</CardFooter>
  </Card>
  ```
- **Card Spacing Token:** Padding is dictated by the `--card-spacing` variable (`py-(--card-spacing)` on Card, `px-(--card-spacing)` on Header/Content/Footer). Default is 24px (`--spacing(6)`), compact cards use 16px (`data-[size=sm]:[--card-spacing:--spacing(4)]`).
- **CardAction Grid Layout:** `CardHeader` uses an `@container/card-header` CSS grid (`has-data-[slot=card-action]:grid-cols-[1fr_auto]`). Never wrap titles and buttons in manual ad-hoc flex divs when `CardAction` provides automatic top-right alignment.
- **Padding Discipline:** Never apply arbitrary `p-6` to `<Card>` while adding `px-0` or `p-0` to children unless implementing a specialized full-bleed chart viewport.

### 3. Header Architecture: Page vs Section Headers
- **Page Headers (No Title Icon, Clean & Compact):**
  - Page-level headers (e.g., *Cluster Overview*, *Cluster Settings*, *Nodes*, *Projects*) must **NEVER** place an icon directly to the left of the main title.
  - Page headers are clean, compact, and unboxed (flat layout, without bulky card borders or gradient boxes).
  - Page headers consist of: title (`text-2xl font-bold tracking-tight text-foreground`), optional real-time status pill (*All Systems Operational* / *Degraded*), subtitle (`text-sm text-muted-foreground`), and right-aligned action buttons.
- **Section Headers (Squircle Icon Pattern):**
  - Section and card-level headers feature a dedicated squircle icon container (`size-9` to `size-10`, `rounded-xl border border-border/80 bg-muted/40 text-foreground shrink-0 shadow-2xs`).
  - The icon is placed to the left of the section title and description, creating an engineered telemetry card aesthetic.
- **Modal / Dialog Headers (Strictly No Title Icon):**
  - Modal and dialog headers (e.g., `DialogHeader`, `SheetHeader`) must **NEVER** place an icon in or beside the heading/title.
  - Modal headers consist solely of clean `DialogTitle` (or `SheetTitle`) and `DialogDescription` (or `SheetDescription`).

### 4. Interactive Controls & Micro-interactions
- **Tactile Click Feedback:** All interactive buttons and click targets must feature the Base Vega tactile 1px vertical translation on click:
  ```css
  active:not-aria-[haspopup]:translate-y-px
  ```
- **Focus Rings:** Accessibility rings must use the non-shifting 3px outline:
  ```css
  focus-visible:ring-3 focus-visible:ring-ring/50 outline-hidden
  ```
- **Polymorphism via `render` Prop:** When nesting links inside buttons (e.g. Next.js `<Link>`), use `@base-ui/react`'s `render` prop (`<Button render={<Link href="..." />} />`) instead of nesting interactive elements or using legacy `asChild`.

### 5. Telemetry & Charting (`shadcn/chart`)
- **No Double ResponsiveContainer:** `ChartContainer` already encapsulates `<RechartsPrimitive.ResponsiveContainer>`. Never wrap charts in an additional `<ResponsiveContainer>`, as this breaks size computation and causes console warnings.
- **Chart Tokens:** Charts must use semantic CSS variable tokens:
  - CPU: `var(--chart-cpu)`
  - RAM: `var(--chart-ram)`
  - Network: `var(--chart-network)`
  - Disk: `var(--chart-disk)`
- **Visual Styling:**
  - `0.15` area fill opacity with linear gradient to `0.0` at bottom.
  - `2px` stroke with round caps.
  - Horizontal gridlines only (`CartesianGrid vertical={false}` with `stroke="var(--border)" strokeOpacity={0.35} strokeDasharray="3 3"`).
  - Tooltips formatted via `<ChartTooltipContent>` with `Geist Mono` values and units.

### 6. Component Sourcing & Installation
- **CLI-First Rule:** Always install official shadcn components using bun:
  ```bash
  bunx --bun shadcn@latest add <component-name>
  ```
- **No Handcrafted Duplicates:** Never create custom implementations of components present in the shadcn registry (e.g. Card, Dialog, DropdownMenu, Tooltip, Sonner, Command, Breadcrumb, Tabs, Slider).
- **Layout Utilities:** Avoid legacy `space-x-*` / `space-y-*` utilities; always use modern flexbox and grid gaps (`gap-1.5`, `gap-2`, `gap-4`, `gap-6`, `gap-8`).

---

## Tako Extensions

This section extends the design system specifically for the Tako PaaS UI. Where it conflicts with a rule above, **this section wins**.

### Density: airy, not compact

Control sizes stay as defined in Layout (36px default). Spaciousness comes from spacing, not bigger controls.

- Page padding: `px-6 lg:px-8`, vertical `py-6 lg:py-8`.
- Section gap: `gap-8`. Grid gap for cards: `gap-6`.
- Table headers: `h-10` (40px) with `bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground`.
- Table body rows: `h-14` (56px). Show at most 6 columns on desktop; secondary data goes in a row detail or a tooltip.
- Never stack more than 3 stat values in one card.

### Glass surfaces (subtle, selective)

Allowed ONLY on: command palette, popovers/dropdowns, dialog overlays, and toast. The top header uses a solid `bg-sidebar` matching the sidebar background. Content cards, tables, and forms stay solid.

- Light: `bg-background/70 backdrop-blur-md border border-border/60`
- Dark: `bg-background/70 backdrop-blur-md border border-white/14` (matching `#FFFFFF24`)
- Must degrade to a solid `bg-background` when `backdrop-filter` is unsupported or `prefers-reduced-transparency` is set.
- No glass on top of glass. No colored glass.

### Brand identity

- **Clean page headers:** Page headers use a flat, uncluttered layout without bulky glowing container boxes, maximizing vertical space for dashboard content.
- **Status indicator:** Card status is communicated cleanly via the StatusBadge at the top right, without redundant left-edge accent borders.
- **Brand tint:** `primary/5` (light) or `primary/15` (dark `#5B63D3`/15) is allowed as a background for the active sidebar item and selected rows. Do not use it elsewhere.

### Status colors

Status colors are semantic and used ONLY to communicate state. Exposed as CSS variables (`--status-success`, `--status-danger`, `--status-info`, `--status-warning`, `--status-neutral`) with light and dark values:

| Token | Palette (Light) | Palette (Dark - BTS) | Meaning |
|---|---|---|---|
| `success` | emerald-500 | emerald-400 | healthy, online, step success, backup OK |
| `danger` | red-500 | coral red (`#FF5A6A`) | unhealthy, failed, offline, error |
| `info` | blue-500 | lavender blue (`#98A4F7`) | deploying, step running, informational |
| `warning` | amber-500 | amber-400 | degraded, near resource limit, pending |
| `neutral` | neutral-500 | slate (`#939DB8`) | stopped, queued, skipped, disabled |

Badge pattern (tinted, never solid):
- Light: `bg-{c}-500/10 text-{c}-700 border-{c}-500/20`
- Dark: `bg-{c}-500/15 text-{c}-400 border-{c}-500/25`
- Status dot: `{c}-500` (light) / status accent (dark). A running/deploying state uses a slow pulse animation on the dot (respecting `prefers-reduced-motion`).

Rules:
- Blue is for status only in status badges, progress, and monitoring.
- Red / `#FF5A6A` is also used for destructive actions, consistent with the `destructive` button variant.
- Never rely on color alone: every status badge also has a text label and/or an icon.
- Resource usage bars: success under 70%, warning 70% to 90%, danger above 90%.

### Deployment step badges

Steps: `Queued → Clone → Build → Push/Load image → Deploy → Health check → Live`.
Mapping: pending = neutral, running = info (pulse), success = success, failed = danger, skipped = neutral (dashed outline). Each badge shows a lucide icon, label, and duration in Geist Mono.

### Chart colors

| Series | Color (Light) | Color (Dark - BTS) |
|---|---|---|
| CPU | indigo-500 | `#5B63D3` (BTS primary) |
| RAM | emerald-500 | emerald-400 |
| Network | blue-500 | `#98A4F7` (BTS primary-60) |
| Disk | amber-500 | amber-400 |

Red is never used for a normal chart series. Use `0.15` opacity area fills, 2px strokes, subtle horizontal gridlines only, and tooltips with Geist Mono values.

### Dark mode

All tokens in dark mode strictly follow the Better Stack Dark (`BTS_DESIGN.md`) system:
- **Canvas / Background:** `#0B0C14`
- **Surface / Card / Popover:** `#131625`
- **Foreground / Headlines:** `#FFFFFF`
- **Primary:** `#5B63D3` (Hover: `#7D87E8`, Link: `#98A4F7`)
- **Secondary Text:** `#939DB8`
- **Muted Fills:** `rgba(147, 157, 184, 0.10)` (`#939DB81A`)
- **Borders:** `rgba(255, 255, 255, 0.14)` (`#FFFFFF24`)
- **Destructive / Error:** `#FF5A6A`
- **Sidebar:** `#0B0C14` background with `rgba(255, 255, 255, 0.14)` border and `#5B63D3` active indicator.

### Logs and terminal

- Always Geist Mono, 13px to 14px, line height 1.5, on a deep dark canvas (`#0B0C14` / `#131625`) in both themes.
- Outlines use faint white borders (`border-white/10` / `rgba(255, 255, 255, 0.14)`).
- Line numbers in muted slate (`#939DB8` / opacity 50%); timestamps dimmed.
- Log levels: error lines tinted danger (`#FF5A6A`), warning lines tinted warning (`amber-400`), step headers in info (`#98A4F7`).
- Virtualized rendering is required for any log longer than 500 lines.

### Motion

- Transitions 150ms to 200ms, `ease-out`. No decorative animation.
- Allowed: status dot pulse, skeleton shimmer, log auto-follow smooth scroll, collapse/expand of finished steps.
- All motion respects `prefers-reduced-motion`.
