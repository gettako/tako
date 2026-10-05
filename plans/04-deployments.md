---
id: 04-deployments
title: Deployments
status: done
blocked_by: [03-service-detail]
blocks: [08-polish]
---

## Goal
Implement the Deployment tab for services, featuring deployment history, 5-version rollback capability, step badge progression (`Queued → Clone → Build → Push/Load image → Deploy → Health check → Live`), and virtualized simulated realtime build logs.

## Scope
- Deployment history list displaying commit hash, message, branch, initiator, duration, and status.
- Rollback workflow enabling instant rollback for any of the 5 latest deployments with confirmation dialog.
- Step badge bar illustrating the 7 pipeline phases (`Queued → Clone → Build → Push/Load image → Deploy → Health check → Live`) with status indicators, icons, and Geist Mono durations.
- Realtime build log stream simulator with timers, virtualized line rendering, step collapsing, auto-follow, pause, search, and copy.
- Empty states, failed deployment triage views, and responsive mobile adaptations.
- Explicitly out of scope: Real CI/CD execution, Docker builds, and live webhook receiver endpoints.

## Acceptance criteria
- [x] AC-1: The Deployment history view renders past deployments with commit hash (Geist Mono), commit message, branch name, trigger source (git push, webhook, manual), relative time, duration, and status badge.
- [x] AC-2: The 5 most recent finished deployments display an enabled "Rollback to this" button, opening a confirmation modal that warns the user and triggers a mock rollback flow.
- [x] AC-3: Deployments older than the top 5 disable the rollback button with a tooltip ("Rollback only available for the 5 most recent deployments").
- [x] AC-4: Selecting a deployment displays the step badge bar featuring all 7 stages: `Queued → Clone → Build → Push/Load image → Deploy → Health check → Live`.
- [x] AC-5: Step badges visually indicate phase status: pending (neutral gray), running (blue info with pulsating dot), success (emerald), failed (red danger), and skipped (neutral gray with dashed border), each displaying a lucide icon, title, and elapsed duration in Geist Mono.
- [x] AC-6: Clicking on any step badge in the bar automatically scrolls the log viewer to that step's log section header.
- [x] AC-7: Finished build steps in the log viewer collapse their output by default with an expand/collapse toggle, while the active running step and any failed step remain expanded.
- [x] AC-8: The build log viewer virtualizes log lines, provides auto-follow smooth scrolling, a pause toggle, a text search bar highlighting matching lines, and a one-click copy button.
- [x] AC-9: Live in-progress deployments simulate line-by-line log streaming with active millisecond timer updates, concluding in either success (`Live`) or failure (`Failed`).
- [x] AC-10: Skeletons, zero-deployment empty states, and full light/dark theme styling operate smoothly across desktop and mobile screens.

## Tasks
- [x] T-1: Deployment history table & rollback mechanism (covers AC-1, AC-2, AC-3)
  - [x] T-1.1: Build `components/services/deployments/deployment-history-table.tsx` displaying commit details, branch, trigger, duration, and status badges.
  - [x] T-1.2: Build `components/services/deployments/rollback-dialog.tsx` presenting rollback commit details, target version, and confirmation action button.
  - [x] T-1.3: Connect mock API rollback action in `lib/api/deployments.ts` creating a new queued deployment at the top of the history list.
- [x] T-2: Step badge progress bar (covers AC-4, AC-5, AC-6)
  - [x] T-2.1: Build `components/services/deployments/step-badge.tsx` rendering step icons, title, status colors, pulsating dot for active running step, and Geist Mono elapsed duration.
  - [x] T-2.2: Build `components/services/deployments/step-badge-bar.tsx` displaying the 7-step horizontal pipeline with connected hairline lines and horizontal scroll on small viewports.
  - [x] T-2.3: Implement step badge click handler dispatching scroll-to-step events to the log container.
- [x] T-3: Realtime build log streamer & virtualized viewer (covers AC-7, AC-8, AC-9)
  - [x] T-3.1: Build `lib/mock/log-streamer.ts` simulating asynchronous log line emission for the 7 build phases with realistic delays and timing markers.
  - [x] T-3.2: Build `components/services/deployments/build-log-section.tsx` supporting collapsible sections for finished steps with Geist Mono headers.
  - [x] T-3.3: Build `components/services/deployments/deployment-log-viewer.tsx` integrating virtualized list rendering, search filtering, copy to clipboard, and auto-scroll/pause toggle.
- [x] T-4: Deployment tab assembly & responsive states (covers AC-10)
  - [x] T-4.1: Build `components/services/deployments/service-deployment-tab.tsx` switching between history list view and active deployment inspection view.
  - [x] T-4.2: Build empty state for newly created services awaiting their first deployment with a "Trigger initial deploy" mock button.
  - [x] T-4.3: Verify responsive layout, ensuring step badges wrap or scroll horizontally without breaking on mobile viewports.

## Blocking and risks
- Blocking: `03-service-detail` (provides parent service detail shell and layout).
- Risks: Performance of simulated streaming logs with high line counts; mitigated by virtualized row rendering using `@tanstack/react-virtual` or light windowing.
- Ponytail note: Use an in-memory `setInterval` stream generator for mock build logs rather than bringing in web-socket or SSE client libraries.

## Notes
- 2026-10-05: Designed the 7-phase deployment pipeline with collapsible log sections and 5-version rollback constraints.
