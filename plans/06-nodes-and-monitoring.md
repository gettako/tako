---
id: 06-nodes-and-monitoring
title: Nodes and Monitoring
status: todo
blocked_by: [01-foundation]
blocks: [08-polish]
---

## Goal
Implement the cluster infrastructure views: the Nodes overview page (`/nodes`), the Node detail page (`/nodes/[id]`), and the deep cluster Monitoring dashboard (`/monitoring`) with per-node metric breakdowns and time range filtering.

## Scope
- Nodes list page (`/nodes`) with aggregate node stats, search filter, and grid/list view toggle.
- Node card and row components featuring 3px left status borders, CPU/RAM/Disk gauges, and connected service counters.
- Node detail page (`/nodes/[id]`) with hardware/OS specifications, uptime telemetry, node-specific resource charts, and list of hosted services.
- Cluster-wide Monitoring page (`/monitoring`) with time range selector (1h, 6h, 24h, 7d), network in/out, disk I/O, and per-node multi-series telemetry charts.
- Explicitly out of scope: Direct SSH key management, live server daemon agents, bare-metal provisioning, and kernel tuning.

## Acceptance criteria
- [ ] AC-1: Nodes page `/nodes` renders summary stats (total nodes, online count, offline count, total CPU cores, total RAM, total disk capacity), search filter, and a grid/list view toggle.
- [ ] AC-2: In grid view, node cards feature a 3px left status accent bar (emerald for online, red for offline), hostname, IP address, agent version, RAM/CPU/Disk mini gauges with percentages, and connected service count.
- [ ] AC-3: In list view, nodes render in a table (`h-14` row height) showing status badge, hostname, IP address, CPU %, RAM %, Disk %, services count, and direct link to node detail.
- [ ] AC-4: Node detail page `/nodes/[id]` renders a host specifications header card showing hostname, public/private IP, OS distribution icon/name, agent version, kernel release, and formatted uptime.
- [ ] AC-5: Node detail page renders 4 dedicated charts for the selected node: CPU utilization (indigo-500), Memory utilization (emerald-500), Disk I/O (amber-500), and Network traffic (blue-500) with 0.15 fill opacity and Geist Mono tooltips.
- [ ] AC-6: Node detail page displays a "Connected Services" table listing all services running on the node with links to their parent projects, type badges (`app`, `compose`, `database`), and status indicators.
- [ ] AC-7: Monitoring page `/monitoring` features a time range selector with 1h, 6h, 24h, and 7d options that updates all chart time series dynamically.
- [ ] AC-8: Monitoring page renders cluster-wide resource telemetry with per-node comparative breakdown series (CPU, RAM, Network In/Out, and Disk Read/Write) using distinct colors and line patterns.
- [ ] AC-9: Offline node states trigger clear visual warnings, and zero-match search filters render friendly `EmptyState` cards with clear action prompts.
- [ ] AC-10: All charts, data tables, and gauge widgets adapt responsively across mobile, tablet, and desktop viewports in both light and dark themes.

## Tasks
- [ ] T-1: Nodes list page (`/nodes`) (covers AC-1, AC-2, AC-3, AC-9, AC-10)
  - [ ] T-1.1: Build `components/nodes/nodes-stats.tsx` displaying cluster hardware totals and node health breakdown.
  - [ ] T-1.2: Build `components/nodes/node-card.tsx` for grid view with 3px status border, IP, hardware gauges, and service count badge.
  - [ ] T-1.3: Build `components/nodes/nodes-table.tsx` for list view with `h-14` row height and column sorting.
  - [ ] T-1.4: Assemble `app/nodes/page.tsx` integrating search filtering, grid/list toggle, empty states, and skeleton loading.
- [ ] T-2: Node detail page (`/nodes/[id]`) (covers AC-4, AC-5, AC-6, AC-10)
  - [ ] T-2.1: Build `components/nodes/node-spec-header.tsx` with hostname, OS distribution, IP, agent version, and uptime counters.
  - [ ] T-2.2: Build `components/nodes/node-metrics-charts.tsx` rendering the 4 dedicated telemetry charts for the individual node.
  - [ ] T-2.3: Build `components/nodes/node-services-table.tsx` displaying services deployed to this node with parent project links and status badges.
  - [ ] T-2.4: Assemble `app/nodes/[id]/page.tsx` with query loading and not-found error handling.
- [ ] T-3: Cluster monitoring page (`/monitoring`) (covers AC-7, AC-8, AC-10)
  - [ ] T-3.1: Build `components/monitoring/monitoring-header.tsx` with page title and time range selector pills (1h, 6h, 24h, 7d).
  - [ ] T-3.2: Build `components/monitoring/cluster-metric-chart.tsx` supporting multi-node line/area charts with per-node series toggles.
  - [ ] T-3.3: Build `components/monitoring/network-disk-charts.tsx` for Network In/Out and Disk Read/Write telemetry.
  - [ ] T-3.4: Assemble `app/monitoring/page.tsx` pulling time-range-aware mock metrics.

## Blocking and risks
- Blocking: `01-foundation` (provides layout shell, mock telemetry data, and base chart tokens).
- Risks: Rendering multi-line chart data across many nodes without visual clutter; mitigated by using distinct stroke patterns and interactive series toggling.
- Ponytail note: Use static mock metric intervals calculated on the fly rather than running active background interval loops for historical chart data.

## Notes
- 2026-10-05: Grouped node management and infrastructure monitoring to share telemetry and chart components efficiently.
