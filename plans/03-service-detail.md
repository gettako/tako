---
id: 03-service-detail
title: Service detail
status: todo
blocked_by: [02-dashboard-and-projects]
blocks: [04-deployments, 05-service-settings, 08-polish]
---

## Goal
Implement the Service detail view (`/projects/[id]/services/[serviceId]`), including the persistent service header, type-aware navigation, and the Overview, Env, Logs, Terminal, Domain, and Database-specific tabs.

## Scope
- Persistent service header: title, status badge, service type badge, action buttons (Deploy, Restart, Stop), last deploy metadata, and primary domain shortcut.
- Service type conditional tab bar supporting `app`, `compose`, and `database` (databases show Connection and Backups instead of Deployment).
- Overview tab: live status, resource utilization versus limits (using `ResourceBar` with 70%/90% thresholds), recent deployment snapshot, and quick info card.
- Env tab: dual-mode environment variable manager (interactive Table view and raw `.env` text view), secret masking toggle, and build-time vs runtime scope selector.
- Logs tab: container runtime log streaming viewer with search, follow, pause, and line-wrap toggles.
- Terminal tab: container shell simulator with container selector dropdown.
- Domain tab: custom domain manager, SSL certificate status badges, and "Add domain" dialog.
- Database service tabs: Connection tab (connection string, credential cards, copy action) and Backups tab (snapshot list, trigger backup action).
- Explicitly out of scope: Full deployment log stream and step badge history (covered in `04-deployments`), and service settings panels (covered in `05-service-settings`).

## Acceptance criteria
- [ ] AC-1: Service detail header renders service name, status badge with pulsating dot when active, type badge (`app`, `compose`, `database`), primary domain link, last deployment status/timestamp, and interactive action buttons (Deploy, Restart, Stop) that trigger mock toast alerts.
- [ ] AC-2: Tab navigation conditionally renders tabs based on service type: `app` and `compose` render Overview, Env, Deployment, Logs, Terminal, Domain, Settings; `database` services hide Deployment and render Connection and Backups tabs.
- [ ] AC-3: Overview tab renders resource usage meters (CPU and RAM) against limits using `ResourceBar` (emerald <70%, amber 70%–90%, red >90%), recent deployment status card, and quick info metadata (container image, node, port, uptime).
- [ ] AC-4: Env tab provides a toggle between Table mode (key, value, scope, actions) and Raw `.env` mode (textarea), maintaining bidirectional state sync.
- [ ] AC-5: In Env Table mode, secret values are obfuscated with dots (`••••••••`) by default with an eye icon toggle to reveal, and each variable features a toggle for Build-time vs Runtime scope.
- [ ] AC-6: Logs tab renders runtime container logs in a dark-themed virtualized container using Geist Mono font, complete with real-time text filter, auto-scroll/follow toggle, stream pause button, and line-wrap switch.
- [ ] AC-7: Terminal tab renders a terminal emulator UI on a dark canvas, supporting simulated basic shell commands (`help`, `ls`, `ps`, `env`, `clear`) and a container selector dropdown for multi-container deployments.
- [ ] AC-8: Domain tab lists configured domains with SSL status badges (emerald Active, amber Provisioning, red Expired/Failed), preview domain links, and an "Add domain" dialog modal with hostname validation.
- [ ] AC-9: For database service types, the Connection tab displays formatted connection URI strings with one-click copy buttons and individual credentials, while the Backups tab lists timestamped database dumps with a "Create backup now" action.
- [ ] AC-10: Loading skeletons, empty states (e.g. no custom domains, no env variables configured), error boundaries, and light/dark theme styling apply across all tabs.

## Tasks
- [ ] T-1: Service detail header & dynamic tab navigation (covers AC-1, AC-2, AC-10)
  - [ ] T-1.1: Build `components/services/service-header.tsx` with breadcrumb, service name, status badge, type badge, primary domain link, and action buttons (Deploy, Restart, Stop).
  - [ ] T-1.2: Build `components/services/service-tabs.tsx` dynamically filtering tabs based on service type (`app`, `compose`, `database`).
  - [ ] T-1.3: Set up routing and layout at `app/projects/[id]/services/[serviceId]/layout.tsx` to host persistent header and active tab content.
- [ ] T-2: Overview tab implementation (covers AC-3)
  - [ ] T-2.1: Build `components/services/overview/resource-metrics-card.tsx` rendering CPU and memory usage against configured limits using `ResourceBar` with 70%/90% alert thresholds.
  - [ ] T-2.2: Build `components/services/overview/quick-info-card.tsx` displaying node assignment, internal ports, restart policy, and uptime.
  - [ ] T-2.3: Build `components/services/overview/recent-deploy-card.tsx` showing last deploy commit, author, timestamp, and status badge.
  - [ ] T-2.4: Assemble `components/services/overview/service-overview-tab.tsx`.
- [ ] T-3: Env tab implementation (covers AC-4, AC-5)
  - [ ] T-3.1: Build `components/services/env/env-table-view.tsx` with inline key-value inputs, secret reveal toggles, Build-time vs Runtime badges, and delete row buttons.
  - [ ] T-3.2: Build `components/services/env/env-raw-view.tsx` with a multi-line monospaced editor for bulk `.env` editing and parsing validation.
  - [ ] T-3.3: Assemble `components/services/env/service-env-tab.tsx` with mode switcher (Table / Raw), dirty state indicator, and "Save changes" mock action.
- [ ] T-4: Logs and Terminal tabs (covers AC-6, AC-7)
  - [ ] T-4.1: Build `components/services/logs/runtime-logs-tab.tsx` embedding `LogViewer` with toolbar controls (search input, follow checkbox, pause button, wrap toggle, and copy logs button).
  - [ ] T-4.2: Build `components/services/terminal/terminal-tab.tsx` with mock command evaluation, command history (up/down arrow keys), container selector select menu, and clear screen trigger.
- [ ] T-5: Domain management tab (covers AC-8)
  - [ ] T-5.1: Build `components/services/domains/domain-list.tsx` showing domains, DNS target instructions, and SSL status badges (emerald Active, amber Provisioning).
  - [ ] T-5.2: Build `components/services/domains/add-domain-dialog.tsx` with domain input, automatic prefix suggestions, and submit validation.
  - [ ] T-5.3: Assemble `components/services/domains/service-domain-tab.tsx`.
- [ ] T-6: Database specific tabs (covers AC-9)
  - [ ] T-6.1: Build `components/services/database/connection-tab.tsx` displaying URI connection strings, password reveal toggle, copy button, and discrete host/port/database cards.
  - [ ] T-6.2: Build `components/services/database/backups-tab.tsx` with backup history table (file size, timestamp, status), restore action dialog, and "Create backup now" button.

## Blocking and risks
- Blocking: `02-dashboard-and-projects` (provides project context and shared service card components).
- Risks: State synchronization between Table view and Raw text view in the Env tab; mitigated by a clean bidirectional parser utility in `lib/utils/env-parser.ts`.
- Ponytail note: Avoid third-party terminal canvas dependencies (e.g. xterm.js); a lightweight styled `<div>` with state-managed lines and an active input prompt satisfies the UI prototype requirements with minimal footprint.

## Notes
- 2026-10-05: Plan designed to give each service tab clear boundaries while accommodating polymorphic service types (`app`, `compose`, `database`).
