## Tako Extensions

This section extends Base Vega for the Tako PaaS UI. Where it conflicts with a rule above, **this section wins**. Specifically it overrides: "information density" in Overview, "Don't add heavy drop shadows" (glass blur is allowed as defined below), and "Don't mix non-neutral background colors for secondary surfaces" (status tints and the brand tint below are allowed).

### Density: airy, not compact

Control sizes stay as defined in Layout (36px default). Spaciousness comes from spacing, not bigger controls.

- Page padding: `px-6 lg:px-8`, vertical `py-6 lg:py-8`.
- Section gap: `gap-8`. Grid gap for cards: `gap-6`.
- Card padding: `p-6` (stat cards `p-5`). Card header to content gap: `gap-4`.
- Table rows: `h-14`. Show at most 6 columns on desktop; secondary data goes in a row detail or a tooltip.
- Never stack more than 3 stat values in one card.

### Glass surfaces (subtle, selective)

Allowed ONLY on: top header, command palette, popovers/dropdowns, dialog overlays, and toast. Content cards, tables, and forms stay solid.

- Light: `bg-background/70 backdrop-blur-md border border-border/60`
- Dark: `bg-background/60 backdrop-blur-md border border-white/10`
- Must degrade to a solid `bg-background` when `backdrop-filter` is unsupported or `prefers-reduced-transparency` is set.
- No glass on top of glass. No colored glass.

### Brand identity

- **Header glow:** page headers and the dashboard hero may use a very soft indigo gradient (`from-primary/5 via-transparent to-transparent`), max 5% opacity.
- **Status accent:** project, service, and node cards show a 3px left accent bar in the card's status color.
- **Brand tint:** `primary/5` is allowed as a background for the active sidebar item and selected rows. Do not use it elsewhere.

### Status colors

Status colors are semantic and used ONLY to communicate state. Use Tailwind v4 palette tokens, exposed as CSS variables (`--status-success`, `--status-danger`, `--status-info`, `--status-warning`, `--status-neutral`) with light and dark values.

| Token | Palette | Meaning |
|---|---|---|
| `success` | emerald | healthy, online, step success, backup OK |
| `danger` | red | unhealthy, failed, offline, error |
| `info` | blue | deploying, step running, informational |
| `warning` | amber | degraded, near resource limit, pending |
| `neutral` | neutral gray | stopped, queued, skipped, disabled |

Badge pattern (tinted, never solid):
- Light: `bg-{c}-500/10 text-{c}-700 border-{c}-500/20`
- Dark: `bg-{c}-500/15 text-{c}-400 border-{c}-500/25`
- Status dot: `{c}-500`. A running/deploying state uses a slow pulse animation on the dot (respect `prefers-reduced-motion`).

Rules:
- Blue is for status only. Never use blue for buttons, links, or focus rings; those use the indigo primary.
- Red is also used for destructive actions, consistent with the `destructive` button variant.
- Never rely on color alone: every status badge also has a text label and/or an icon.
- Resource usage bars: success under 70%, warning 70% to 90%, danger above 90%.

### Deployment step badges

Steps: `Queued → Clone → Build → Push/Load image → Deploy → Health check → Live`.
Mapping: pending = neutral, running = info (pulse), success = success, failed = danger, skipped = neutral (dashed outline). Each badge shows a lucide icon, label, and duration in Geist Mono.

### Chart colors

| Series | Color |
|---|---|
| CPU | indigo-500 |
| RAM | emerald-500 |
| Network | blue-500 |
| Disk | amber-500 |

Red is never used for a normal chart series. Use `0.15` opacity area fills, 2px strokes, subtle horizontal gridlines only, and tooltips with Geist Mono values. Use distinct line patterns or markers in addition to color when more than one series is shown.

### Dark mode

Provide complete dark values for every token (the base dark background is `oklch(0.145 0 0)`):
- Surface: `oklch(0.205 0 0)`; border: `oklch(1 0 0 / 10%)`; muted foreground: `oklch(0.708 0 0)`.
- Status text in dark uses the `-400` shade, dots and bars use `-500`.
- Glass surfaces follow the dark recipe above.

### Logs and terminal

- Always Geist Mono, 13px to 14px, line height 1.5, on a dark surface in both themes.
- Line numbers in muted foreground; timestamps optional and dimmed.
- Log levels: error lines tinted danger, warning lines tinted warning, step headers in info.
- Virtualized rendering is required for any log longer than 500 lines.

### Motion

- Transitions 150ms to 200ms, `ease-out`. No decorative animation.
- Allowed: status dot pulse, skeleton shimmer, log auto-follow smooth scroll, collapse/expand of finished steps.
- All motion respects `prefers-reduced-motion`.
