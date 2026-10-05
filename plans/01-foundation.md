---
id: 01-foundation
title: Foundation
status: done
blocked_by: []
blocks: [02-dashboard-and-projects, 06-nodes-and-monitoring, 07-account-and-admin]
---

## Goal
Establish core design tokens, documentation alignments, mock data architecture, domain types, Ponytail engineering guidelines, application shell, and reusable base UI components for Tako.

## Scope
- Append Appendix A (Tako Extensions) to `DESIGN.md` and update `AGENTS.md` with status color rules, mock conventions, UI-only scope, and the active stack.
- Configure Tailwind v4 semantic status color variables, chart tokens, and subtle glass recipes in `globals.css` with light and dark mode variants.
- Define domain models in `lib/types` and implement realistic mock API data services with artificial latency in `lib/api/*`.
- Build the global responsive application shell: collapsible sidebar navigation, airy header with breadcrumbs, command palette trigger button, notification bell with unread indicator, theme toggle, avatar dropdown, and a cluster-wide offline node warning banner.
- Build foundation UI components: `StatCard`, `StatusBadge` (with tinted container and pulse dot), `StatusAccentCard` (3px left border), `ViewToggle` (grid/list), `ResourceBar` (dynamic 70/90 threshold colors), `EmptyState`, `ErrorState`, `LoadingSkeleton`, and virtualized `LogViewer` base.
- Explicitly out of scope: Live backend integration, gRPC, Go code, real authentication, or external Docker/database APIs.

## Acceptance criteria
- [x] AC-1: `DESIGN.md` includes the verbatim Tako Extensions (Appendix A), and `AGENTS.md` explicitly documents the "blue is status-only" rule, mock layer convention (`lib/api/*`, `lib/types`), UI-only scope, and Ponytail minimalist engineering doctrine.
- [x] AC-2: Global CSS tokens provide semantic status colors (emerald success, red danger, blue info, amber warning, neutral gray) and chart colors (indigo CPU, emerald RAM, blue Network, amber Disk) across both light and dark themes.
- [x] AC-3: All domain entities (`Project`, `Service`, `Node`, `Deployment`, `DeploymentStep`, `CronJob`, `Webhook`, `WebhookDelivery`, `ResourceLimit`, `EnvVar`, `User`, `Session`, `AuditLog`, `S3Bucket`, `GitProvider`, `SyncedRepo`, `Notification`) are defined with strict TypeScript types in `lib/types`.
- [x] AC-4: Mock API modules in `lib/api/*` return typed Promises with simulated network delay (150ms–350ms) and cover healthy, degraded, deploying, failed, and empty scenarios.
- [x] AC-5: The global shell displays a sticky sidebar (Dashboard, Projects, Nodes, Monitoring, Audit Logs, Settings) with active state highlighting (`primary/5` background and indigo text) and collapses cleanly on mobile viewports into a slide-over sheet.
- [x] AC-6: The header provides breadcrumb navigation, a ⌘K search trigger button, a notification bell icon with an unread badge, a dark/light mode toggle, and an avatar menu linking to `/profile`.
- [x] AC-7: A global persistent banner appears at the top of the viewport whenever one or more nodes in the cluster are offline, displaying the count and a quick link to `/nodes`.
- [x] AC-8: The `StatusBadge` component renders a tinted background (`bg-{c}-500/10`), border, text, accessible label/icon, and an animated pulsating dot for running/deploying states.
- [x] AC-9: The `ResourceBar` component displays usage against limit with a progress bar that shifts colors: emerald under 70%, amber between 70% and 90%, and red above 90%.
- [x] AC-10: Shared `EmptyState`, `ErrorState`, and `LoadingSkeleton` components render consistently with generous spacing (`p-6` to `p-8`) across both light and dark modes.

## Tasks
- [x] T-1: Document alignment & Ponytail guidelines (covers AC-1)
  - [x] T-1.1: Ensure Appendix A is appended to `DESIGN.md` without modifying existing sections.
  - [x] T-1.2: Update `AGENTS.md` to document the status color rules, "blue is status-only" principle, mock data patterns (`lib/api/*`, `lib/types`), and the Ponytail engineering rules (YAGNI, stdlib first, native platform features, zero speculative abstractions).
- [x] T-2: Theme tokens & CSS variables setup (covers AC-2)
  - [x] T-2.1: Add `--status-success`, `--status-danger`, `--status-info`, `--status-warning`, and `--status-neutral` tokens to `globals.css` with light and dark mode OKLCH values.
  - [x] T-2.2: Add chart tokens `--chart-cpu` (indigo), `--chart-ram` (emerald), `--chart-network` (blue), and `--chart-disk` (amber).
  - [x] T-2.3: Configure glass surface utilities (`bg-background/70 backdrop-blur-md border border-border/60` light, `bg-background/60 backdrop-blur-md border border-white/10` dark) with solid fallback when transparency is reduced.
- [x] T-3: Domain types in `lib/types` (covers AC-3)
  - [x] T-3.1: Create `lib/types/common.ts` for pagination, status enums (`Status = 'healthy' | 'unhealthy' | 'degraded' | 'deploying' | 'stopped' | 'queued'`), and resource limit interfaces.
  - [x] T-3.2: Create `lib/types/project.ts` and `lib/types/service.ts` supporting `app`, `compose`, and `database` types.
  - [x] T-3.3: Create `lib/types/node.ts`, `lib/types/deployment.ts`, `lib/types/cron.ts`, `lib/types/webhook.ts`, `lib/types/audit.ts`, and `lib/types/settings.ts`.
- [x] T-4: Mock API services in `lib/api/*` (covers AC-4)
  - [x] T-4.1: Create mock seed data in `lib/mock/data.ts` containing realistic projects, services with varied health states, nodes, deployments, and metrics time series.
  - [x] T-4.2: Implement mock endpoints with simulated latency (`lib/api/projects.ts`, `lib/api/services.ts`, `lib/api/nodes.ts`, `lib/api/deployments.ts`, `lib/api/metrics.ts`, `lib/api/audit.ts`, `lib/api/settings.ts`).
  - [x] T-4.3: Configure TanStack Query client and React Query provider in `components/query-provider.tsx`.
- [x] T-5: Global application shell (covers AC-5, AC-6, AC-7)
  - [x] T-5.1: Build `components/layout/sidebar.tsx` with navigation links (Dashboard, Projects, Nodes, Monitoring, Audit Logs, Settings) and mobile drawer behavior.
  - [x] T-5.2: Build `components/layout/header.tsx` with dynamic breadcrumbs, ⌘K trigger button, notification bell with unread counter, theme toggle, and user avatar dropdown linking to `/profile`.
  - [x] T-5.3: Build `components/layout/offline-node-banner.tsx` displaying cluster warnings when any node status is offline.
  - [x] T-5.4: Assemble `components/layout/app-shell.tsx` combining sidebar, header, banner, and main content area with airy spacing (`px-6 lg:px-8 py-6 lg:py-8`).
- [x] T-6: Base UI components (covers AC-8, AC-9, AC-10)
  - [x] T-6.1: Build `components/ui/status-badge.tsx` supporting tinted backgrounds, border tints, status dots with pulse animations for deploying/running, and accessible text/icons.
  - [x] T-6.2: Build `components/ui/status-accent-card.tsx` providing standard card styling with a 3px left accent bar reflecting item status.
  - [x] T-6.3: Build `components/ui/resource-bar.tsx` rendering percentage bars transitioning green (<70%), amber (70%–90%), and red (>90%).
  - [x] T-6.4: Build `components/ui/view-toggle.tsx` for switching between grid card view and table list view.
  - [x] T-6.5: Build `components/ui/stat-card.tsx` with spacious padding (`p-5`), icon, value, change indicator, and subtext.
  - [x] T-6.6: Build `components/ui/empty-state.tsx`, `components/ui/error-state.tsx`, and `components/ui/loading-skeleton.tsx`.
  - [x] T-6.7: Build `components/ui/log-viewer.tsx` virtualized scrolling baseline using `@tanstack/react-virtual` with Geist Mono styling, line numbers, and dark container canvas.

## Blocking and risks
- Blocking: None.
- Risks: Ensuring all shadcn components are added via the CLI (`bunx --bun shadcn@latest add <component>`) rather than handcrafted.
- Ponytail note: Avoid over-abstracting the mock API; plain exported async functions operating on in-memory mutable arrays are preferred over heavy simulated databases or ORMs.

## Notes
- 2026-10-05: Foundation plan drafted to define global tokens, Ponytail constraints, types, mock services, and shared UI primitives before feature pages.
