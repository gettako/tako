---
id: 02-dashboard-and-projects
title: Dashboard and Projects
status: done
blocked_by: [01-foundation]
blocks: [03-service-detail, 08-polish]
---

## Goal
Implement the main cluster Dashboard (`/`), the Projects index page (`/projects`), and the Project detail view (`/projects/[id]`) with responsive card grid and list views, telemetry charts, and service health summaries.

## Scope
- Dashboard page (`/`) featuring cluster stats, 4 resource utilization charts (CPU, RAM, Network, Disk), a node summary widget, and a recent deployments list.
- Projects overview page (`/projects`) with aggregate stats, real-time search, grid/list view toggle, and project cards with 3px left status borders.
- Project detail page (`/projects/[id]`) displaying project metadata, service-level stats, service search, and grid/list services list.
- Empty states, loading skeletons, error states, and responsive mobile behaviors for all three views.
- Explicitly out of scope: Service detail internal tabs (covered in `03-service-detail` through `05-service-settings`), node management operations, and live deployment triggers.

## Acceptance criteria
- [x] AC-1: Dashboard `/` renders top stat cards showing total projects, total services, healthy services, and unhealthy/degraded counts with appropriate status colors.
- [x] AC-2: Dashboard renders 4 separate telemetry charts using shadcn Chart (Recharts) for CPU (indigo-500), RAM (emerald-500), Network (blue-500), and Disk (amber-500), with 0.15 area fill opacity, 2px stroke, subtle grid lines, and Geist Mono tooltip numbers.
- [x] AC-3: Dashboard renders a node summary section (showing active nodes, status indicators, and basic usage) and a recent deployments feed displaying service name, commit hash, timestamp, and status badge.
- [x] AC-4: Projects page `/projects` features an aggregate stats bar, an instant text search filter, and a toggle button to switch between grid card view and table list view.
- [x] AC-5: In grid view, project cards display a 3px left status accent bar, project name, total services count, and breakdown tags showing healthy, unhealthy, and stopped service counts.
- [x] AC-6: In list view, projects display as structured table rows (`h-14`) with project name, service counts breakdown, status summary badge, and direct click navigation.
- [x] AC-7: Project detail page `/projects/[id]` presents the project header with breadcrumbs, project stats, a search input for services, and a grid/list toggle.
- [x] AC-8: Each service item in the project detail page displays service name, type badge (`app`, `compose`, `database`), status badge, target node name, primary domain, and last deployment details (commit hash in Geist Mono, relative timestamp, and status).
- [x] AC-9: Zero search results and empty project/service states render friendly `EmptyState` components with clear prompts and action triggers.
- [x] AC-10: All layouts adapt responsively (stacking stat cards and charts vertically on mobile screens) and render seamlessly in both light and dark themes.

## Tasks
- [x] T-1: Dashboard stats and telemetry charts (covers AC-1, AC-2)
  - [x] T-1.1: Build `components/dashboard/dashboard-stats.tsx` to display cluster-level metrics (total projects, services, online nodes, unhealthy alerts).
  - [x] T-1.2: Build `components/dashboard/resource-chart.tsx` implementing Recharts area chart configured with Base Vega styling and Tako chart tokens (CPU: indigo, RAM: emerald, Network: blue, Disk: amber).
  - [x] T-1.3: Create `components/dashboard/dashboard-charts-grid.tsx` organizing the 4 charts in an airy 2x2 grid with `gap-6`.
- [x] T-2: Dashboard widgets & page integration (covers AC-3, AC-10)
  - [x] T-2.1: Build `components/dashboard/node-summary-widget.tsx` showing condensed cards/rows for each node with status dots and RAM/CPU meters.
  - [x] T-2.2: Build `components/dashboard/recent-deployments-widget.tsx` rendering the latest 5 deployments with step status and relative timestamps.
  - [x] T-2.3: Assemble the Dashboard page at `app/page.tsx` with TanStack Query fetching mock data, complete loading skeletons, and error handling.
- [x] T-3: Projects overview page (`/projects`) (covers AC-4, AC-5, AC-6, AC-9, AC-10)
  - [x] T-3.1: Build `components/projects/projects-header.tsx` with title, stat cards, search input, and view toggle (grid/list).
  - [x] T-3.2: Build `components/projects/project-card.tsx` for grid view, featuring a 3px left status accent border, service health counter pills (emerald, red, neutral), and hover elevation.
  - [x] T-3.3: Build `components/projects/projects-table.tsx` for list view with `h-14` table rows, column sorting, and responsive column hiding.
  - [x] T-3.4: Assemble `app/projects/page.tsx` integrating search query filtering, empty states for zero matching items, and skeleton loaders.
- [x] T-4: Project detail page (`/projects/[id]`) (covers AC-7, AC-8, AC-9, AC-10)
  - [x] T-4.1: Build `components/projects/project-detail-header.tsx` with breadcrumbs, project description, status overview, and project-level stat counters.
  - [x] T-4.2: Build `components/projects/service-card.tsx` (grid mode) and `components/projects/service-row.tsx` (list mode) showing type badge (`app`, `compose`, `database`), status badge, node name, primary domain, and last deploy metadata.
  - [x] T-4.3: Assemble `app/projects/[id]/page.tsx` with service search filtering, view switcher, empty state for projects with zero services, and query error boundary.

## Blocking and risks
- Blocking: `01-foundation` must be complete (provides layout shell, mock API services, chart CSS variables, and base components).
- Risks: Recharts hydration mismatch in Next.js App Router; mitigated by wrapping charts in dynamic client components or rendering skeletons during initial mount.
- Ponytail note: Use simple client-side array filtering for search and view toggle instead of external search libraries or complex URL state machines.

## Notes
- 2026-10-05: Plan structured to cover both high-level cluster telemetry and granular project/service listings.
