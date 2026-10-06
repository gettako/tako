---
version: 1.0.0
name: Tako Design System (Base Vega & Better Stack Dark)
description: High-precision PaaS design system combining Base Vega light mode (pure white canvas with electric indigo) and Better Stack Dark mode (cinematic dark canvas with crisp blue-violet accents).
modes:
  light:
    primary: "#432DD7"
    secondary: "#F4F4F5"
    tertiary: "#6366F1"
    neutral: "#737373"
    surface: "#FFFFFF"
    background: "#FFFFFF"
    outline: "#E5E5E5"
    error: "#E7000B"
  dark:
    primary: "#5B63D3"
    primary-60: "#98A4F7"
    primary-70: "#7D87E8"
    secondary: "#939DB8"
    tertiary: "#FFFFFF"
    neutral: "#0B0C14"
    surface: "#131625"
    on-surface: "#FFFFFF"
    muted: "#939DB81A"
    border: "#FFFFFF24"
    accent-glow: "#FFFFFF40"
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
1. **Light Mode (Base Vega):** Clean, crisp, high-clarity interface with pure white (`#FFFFFF`) as the primary canvas and card surface color, paired with electric indigo (`#432DD7`) accents and hairline outline borders (`#E5E5E5`).
2. **Dark Mode (Better Stack Dark):** A high-contrast dark SaaS environment with an obsidian neutral canvas (`#0B0C14`), slightly lifted dark surface panels (`#131625`), crisp blue-violet CTAs (`#5B63D3`), muted slate supportive typography (`#939DB8`), translucent fills (`#939DB81A`), faint white borders (`#FFFFFF24`), button inner sheens (`#FFFFFF40`), and vivid coral alerts (`#FF5A6A`).

---

## Colors

### Light Mode (Base Vega)

Rooted in a pure `#FFFFFF` background with high contrast and precision:

- **Background (#FFFFFF):** Primary canvas background (`oklch(1 0 0)`).
- **Surface / Card (#FFFFFF):** Pure white container fill for cards, popovers, and modal dialogs.
- **Primary (#432DD7):** Electric Indigo (`oklch(0.457 0.24 277.023)`). Central action driver for interactive controls, focus rings, and primary highlights. Paired with lavender-white text (`#EEF2FF` / `oklch(0.962 0.018 272.314)`).
- **Secondary (#F4F4F5):** Subtle cool slate (`oklch(0.967 0.001 286.375)`). Used for secondary buttons and quiet surfaces.
- **Tertiary (#6366F1):** Vivid indigo accent for hover shifts and secondary emphasis.
- **Neutral (#737373):** Mid-tone neutral gray (`oklch(0.556 0 0)`). Used for muted descriptions and metadata.
- **Outline / Border (#E5E5E5):** Clean hairline border (`oklch(0.922 0 0)`). Defines structural containment.
- **Error (#E7000B):** Vivid coral red (`oklch(0.577 0.245 27.325)`).

### Dark Mode (Better Stack Dark)

Derived directly from `BTS_DESIGN.md` for developer-centric telemetry and cloud infrastructure clarity:

- **Neutral / Background (#0B0C14):** The near-black base background that creates the brand's deep, cinematic stage.
- **Surface / Card (#131625):** A slightly lifted dark panel color for cards, inputs, popovers, and inset UI blocks.
- **On-Surface / Tertiary (#FFFFFF):** Pure white for hero headlines, card titles, key controls, and maximal contrast.
- **Primary (#5B63D3):** A blue-violet action color used for primary conversion CTAs, active sidebar tabs, and interactive highlights.
- **Primary-70 (#7D87E8):** A mid-luminosity blue-violet variant used for primary button hover states and active emphasis.
- **Primary-60 (#98A4F7):** A lighter lavender-blue used for links, step indicators, and secondary highlights.
- **Secondary (#939DB8):** A muted slate-blue-gray used for supportive text, descriptions, table headers, metadata, and lower-priority UI copy.
- **Muted (#939DB81A / `rgba(147, 157, 184, 0.10)`):** A translucent slate fill tone used for quiet buttons, subtle badge fills, and section dividers without harsh lines.
- **Border (#FFFFFF24 / `rgba(255, 255, 255, 0.14)`):** A faint white border treatment that keeps card, table, and dialog outlines visible but understated.
- **Accent Glow (#FFFFFF40 / `inset 0 1px 0 rgba(255, 255, 255, 0.25)`):** A light inset sheen that gives primary buttons a tactile, premium finish.
- **Error (#FF5A6A):** A vivid alert color reserved for validation errors, destructive actions, and critical failure states.

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

## Elevation & Depth

The UI is intentionally flat in terms of shadow depth; hierarchy comes from contrast, hairline borders, and tonal layering rather than heavy drop shadows.

- **Light Mode:** Pure `#FFFFFF` cards bordered by subtle `#E5E5E5` hairline strokes.
- **Dark Mode (Better Stack Dark):** Deep `#0B0C14` background with elevated `#131625` surface cards, separated by thin translucent white borders (`#FFFFFF24` / `rgba(255, 255, 255, 0.14)`).
- **Tactile Feedback:** Interactive buttons feature a subtle 1px vertical translation on click (`active:not-aria-[haspopup]:translate-y-px`).
- **Accent Glow:** Primary buttons in dark mode feature a subtle inset highlight (`dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]`).
- **Focus Rings:** Accessibility rings utilize a 3px ring (`focus-visible:ring-3 focus-visible:ring-ring/50`) without layout shift.

---

## Shapes

The shape hierarchy is derived from a 10px base radius (`--radius: 0.625rem`):

- **Small (`4px` / `radius-xs`):** Minor tags, indicators, and secondary button corners.
- **Medium (`8px`–`10px` / `radius-md`): Default corner radius for buttons, inputs, selects, and dropdown list items.
- **Large (`10px`–`12px` / `radius-lg`): Default cards, dialog modals, and dropdown popovers.
- **2XL / 4XL (`18px`–`26px`): Floating presentation panels, hero containers, and major dashboard cards.
- **Full (`9999px`):** Status badges, chips, user avatars, and circular action buttons.

---

## Components

Components are built on `@base-ui/react` primitives and styled with Tailwind CSS v4 class utilities:

### Buttons

- **Primary (`variant="default"`):**
  - Light: Solid electric indigo (`bg-primary text-primary-foreground hover:bg-primary/90`).
  - Dark (BTS): Solid blue-violet (`bg-[#5B63D3] text-white hover:bg-[#7D87E8] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]`).
- **Secondary (`variant="secondary"`):**
  - Light: Soft slate background (`bg-secondary text-secondary-foreground`).
  - Dark (BTS): Translucent surface (`dark:bg-card dark:border dark:border-border dark:text-foreground dark:hover:bg-card/80`).
- **Outline (`variant="outline"`):**
  - Light: Bordered white canvas (`border-border bg-background hover:bg-muted`).
  - Dark (BTS): Transparent background with faint border (`dark:border-border dark:bg-transparent dark:hover:bg-muted dark:hover:text-foreground`).
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
- Light Mode: Clean bordered fields with muted placeholder text.
- Dark Mode (BTS): Lifted dark surface fields (`dark:bg-card` / `#131625`), faint translucent border (`dark:border-border` / `#FFFFFF24`), high-contrast white text (`#FFFFFF`), and muted slate placeholder (`#939DB8`).

### Cards & Panels

- Container padding follows the 8pt rhythm (`p-6` standard, `p-5` for stat cards).
- Light Mode: Solid white container fill (`#FFFFFF`) with `#E5E5E5` hairline border.
- Dark Mode (BTS): Dark surface container fill (`#131625`) on `#0B0C14` canvas with `#FFFFFF24` border, `#FFFFFF` title, and `#939DB8` secondary text.

### Chips & Badges

- Fully rounded corners (`rounded-full`), compact internal padding (`px-2.5 py-0.5`).
- Light Mode: Tinted background (`bg-{c}-500/10`), border, and text.
- Dark Mode (BTS): Low-contrast surface fill (`dark:bg-card`), faint white border (`dark:border-border`), and slate text (`#939DB8`), or status-tinted variants (`dark:bg-{c}-500/15`).

---

## Do's and Don'ts

- **Do** keep light mode strictly on a pure white canvas (`bg-white` / `#FFFFFF`) with crisp borders.
- **Do** keep dark mode deep, cinematic, and high-contrast (`#0B0C14` background, `#131625` surface, `#FFFFFF` headlines).
- **Do** use the blue-violet primary color (`#5B63D3`) for CTAs, active sidebar selection, and interactive focus states in dark mode.
- **Do** use `#7D87E8` for primary button hover states and `#98A4F7` for link buttons and secondary highlights in dark mode.
- **Do** maintain `gap-1.5` (6px) between icons and labels in standard 36px controls.
- **Do** favor thin borders (`#FFFFFF24` in dark, `#E5E5E5` in light) and tonal surface changes over heavy shadows.
- **Don't** mix saturated colors into background or container fills; all secondary surfaces should remain neutral or surface-toned.
- **Don't** use blue for buttons or links in places where it conflicts with the "blue is status-only" rule in monitoring copy.
- **Don't** introduce heavy drop shadows; depth is achieved via tonal contrast and subtle 1px border lines.

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
- Card padding: `p-6` (stat cards `p-5`). Card header to content gap: `gap-4`.
- Table rows: `h-14`. Show at most 6 columns on desktop; secondary data goes in a row detail or a tooltip.
- Never stack more than 3 stat values in one card.

### Glass surfaces (subtle, selective)

Allowed ONLY on: command palette, popovers/dropdowns, dialog overlays, and toast. The top header uses a solid `bg-sidebar` matching the sidebar background. Content cards, tables, and forms stay solid.

- Light: `bg-background/70 backdrop-blur-md border border-border/60`
- Dark: `bg-background/70 backdrop-blur-md border border-white/14` (matching `#FFFFFF24`)
- Must degrade to a solid `bg-background` when `backdrop-filter` is unsupported or `prefers-reduced-transparency` is set.
- No glass on top of glass. No colored glass.

### Brand identity

- **Clean page headers:** Page headers use a flat, uncluttered layout without bulky glowing container boxes, maximizing vertical space for dashboard content.
- **Status accent:** Project, service, and node cards show a 3px left accent bar in the item's status color.
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
