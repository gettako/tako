---
id: 08-polish
title: Polish
status: done
blocked_by: [02-dashboard-and-projects, 03-service-detail, 04-deployments, 05-service-settings, 06-nodes-and-monitoring, 07-account-and-admin]
blocks: []
---

## Goal
Implement cross-cutting global utilities—the ⌘K Command Palette, the Notification Center popover, the dev-only mock Scenario Switcher—and execute a comprehensive responsive, dark mode, and accessibility audit across the entire application.

## Scope
- Command palette (⌘K) with keyboard shortcut listener, fuzzy search over projects, services, nodes, and quick actions, styled with subtle glass effects.
- Notification center popover triggered from the header bell icon, displaying high-priority alerts (deploy failed, node offline, backup failed) with mark-as-read and navigation.
- Dev-only scenario switcher allowing dynamic toggling between `Normal`, `Many Errors`, and `Empty` data scenarios with reactive UI state invalidation.
- Comprehensive dark mode contrast and color audit ensuring compliance with Base Vega and Tako Extensions.
- Responsive layout audit across mobile (<640px), tablet (640px–1024px), and desktop (>1024px) viewports.
- Accessibility, focus rings, keyboard traps, and `prefers-reduced-motion` compliance.
- Explicitly out of scope: Native OS desktop push notifications, external web search integrations, and production bundle minification optimizations.

## Acceptance criteria
- [x] AC-1: Pressing ⌘K (or Ctrl+K) or clicking the header search button opens the Command Palette in a subtle glass modal dialog (`bg-background/70 backdrop-blur-md`).
- [x] AC-2: Command palette results are grouped into Projects, Services, Nodes, and Quick Actions (e.g. "Deploy service...", "Create new project...", "Toggle theme"), navigating instantly to the target upon pressing Enter.
- [x] AC-3: Clicking the notification bell in the header opens a subtle glass popover displaying active cluster notifications (deployment failures, offline nodes, failed database backups) with relative timestamps.
- [x] AC-4: Users can click any notification to navigate directly to the relevant resource, and click "Mark all as read" to dismiss unread status badges.
- [x] AC-5: A persistent floating dev-only widget at the bottom corner allows switching between three scenarios: `Normal` (balanced healthy/unhealthy cluster), `Many Errors` (multiple nodes offline, degraded services, failed deployments), and `Empty` (clean slate zero-data cluster).
- [x] AC-6: Switching scenarios immediately refreshes TanStack Query caches, dynamically transforming all pages into the corresponding scenario state without requiring a full browser reload.
- [x] AC-7: In the `Empty` scenario, all major views (Dashboard, Projects, Services, Nodes, Audit Logs) display tailored, spacious empty states with helpful illustrations and action buttons.
- [x] AC-8: Full dark mode styling is validated across all pages: base background is deep carbon (`oklch(0.145 0 0)`), surfaces are `oklch(0.205 0 0)`, borders are `oklch(1 0 0 / 10%)`, and status badge text uses high-contrast `-400` shades.
- [x] AC-9: Mobile responsiveness audit ensures navigation drawers slide cleanly, headers do not overflow, tables scroll smoothly horizontally with sticky header cells, and touch targets satisfy the 36px minimum standard.
- [x] AC-10: All animations (status dot pulse, skeleton shimmer, log auto-follow, accordion expand/collapse) strictly respect `prefers-reduced-motion` media queries.

## Tasks
- [x] T-1: Command Palette (⌘K) implementation (covers AC-1, AC-2)
  - [x] T-1.1: Install shadcn Command component (`bunx --bun shadcn@latest add command`) and build `components/command-palette/command-dialog.tsx`.
  - [x] T-1.2: Build global keyboard listener hook `hooks/use-command-palette.ts` responding to ⌘K and custom trigger events.
  - [x] T-1.3: Populate search index across mock projects, services, nodes, and navigation shortcuts with quick action handlers.
- [x] T-2: Notification Center implementation (covers AC-3, AC-4)
  - [x] T-2.1: Build `components/notifications/notification-popover.tsx` with subtle glass styling (`bg-background/70 backdrop-blur-md border border-border/60`).
  - [x] T-2.2: Build `components/notifications/notification-item.tsx` rendering alert type icon (red for failure, amber for warning), timestamp, and mark-as-read indicator.
  - [x] T-2.3: Connect notification store with unread counter badge in header bell icon.
- [x] T-3: Dev-only Scenario Switcher (covers AC-5, AC-6, AC-7)
  - [x] T-3.1: Build `lib/mock/scenarios.ts` defining data sets for `Normal`, `Many Errors`, and `Empty` scenarios.
  - [x] T-3.2: Build `components/dev/scenario-switcher.tsx` floating widget with quick selector pills and active scenario badge.
  - [x] T-3.3: Implement cache invalidation utility notifying TanStack Query to refetch current queries upon scenario switch.
- [x] T-4: Dark mode & theme contrast audit (covers AC-8)
  - [x] T-4.1: Audit all components in dark mode ensuring border contrast (`oklch(1 0 0 / 10%)`) and carbon background alignment.
  - [x] T-4.2: Verify status color tokens in dark mode use `-400` shades for text and `-500` shades for dots and accent bars.
  - [x] T-4.3: Validate subtle glass degradation to solid backgrounds when `prefers-reduced-transparency` is enabled.
- [x] T-5: Responsive mobile layout & accessibility pass (covers AC-9, AC-10)
  - [x] T-5.1: Test and adjust mobile layout padding (`px-6 py-6`) and table horizontal scroll containers across small viewports (<640px).
  - [x] T-5.2: Test keyboard tab navigation and focus ring indicators (`focus-visible:ring-3 focus-visible:ring-ring/50`) across all interactive controls.
  - [x] T-5.3: Ensure all animations and pulsating status dots wrap in `@media (prefers-reduced-motion: no-preference)`.

## Blocking and risks
- Blocking: `02-dashboard-and-projects`, `03-service-detail`, `04-deployments`, `05-service-settings`, `06-nodes-and-monitoring`, `07-account-and-admin`.
- Risks: Performance impact of global scenario switching; mitigated by using in-memory state and simple TanStack Query `invalidateQueries()` calls.
- Ponytail note: Avoid third-party complex state machines or full Redux/Zustand store trees for scenario switching; a lightweight React context with `useState` and QueryClient invalidation does the job in under 40 lines.

## Notes
- 2026-10-05: Final polish plan to bind all views into a cohesive, responsive, accessible, and easily testable prototype.
