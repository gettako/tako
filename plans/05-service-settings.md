---
id: 05-service-settings
title: Service settings
status: todo
blocked_by: [03-service-detail]
blocks: [08-polish]
---

## Goal
Implement the comprehensive service Settings tab, including section sidebar navigation, General configuration, Resource limits management, Cron auxiliary job scheduling, Webhook trigger configuration, and the Danger zone.

## Scope
- Tab-internal sub-navigation sidebar routing between General, Resource limits, Cron, Webhook, and Danger zone.
- General settings: service rename, Git repository/branch connection, build command, and Dockerfile path.
- Resource limits: CPU, memory, and optional swap inputs, visual usage vs limit progress bars, and "applies after restart" reminder banner.
- Cron auxiliary jobs: scheduled job table with human-readable schedule descriptions, cron validation with next 5 runs preview, job run history drawer, and immediate "Run now" trigger.
- Webhook settings: secret webhook URL display, token regeneration, trigger event switches (branch push, new tag, manual), and recent delivery log table.
- Danger zone: service deletion workflow with name confirmation challenge.
- Explicitly out of scope: Operating system cgroup kernel configuration, real cron daemon execution, and external Git webhook registration.

## Acceptance criteria
- [ ] AC-1: The Settings tab renders a sub-navigation sidebar on desktop (vertical list) and a horizontal scrollable tab bar on mobile to switch between the 5 settings sections.
- [ ] AC-2: The General section allows editing service name, repository branch, build command, and Dockerfile path with form validation and a "Save changes" mock toast.
- [ ] AC-3: The Resource limits section provides CPU (cores/millicores), Memory (MB/GB), and optional Swap inputs, displays current utilization against the proposed limit, and shows an informational banner ("Changes apply after service restart").
- [ ] AC-4: The Cron section renders a table of auxiliary jobs with columns for Name, Schedule (cron expression + human-readable translation like "Every 15 minutes"), Command, Active toggle, Last run, and Next run.
- [ ] AC-5: The "Add / Edit Cron job" dialog validates cron expressions in real-time, displays a list preview of the next 5 run dates/times, and allows saving or canceling.
- [ ] AC-6: Each cron job has a "Run now" trigger button with instant feedback, and a "History" action opening a modal displaying previous execution timestamps, durations, and exit statuses.
- [ ] AC-7: The Webhook section displays the unique deployment webhook URL with a copy button and a "Regenerate token" action with a security confirmation popover.
- [ ] AC-8: The Webhook section provides toggles for event triggers (Push to branch, New tag created, Manual) and a recent deliveries table showing timestamp, trigger event, status code badge (emerald 200, red 500), and a payload preview sheet.
- [ ] AC-9: The Danger zone is visually isolated with a destructive border and provides a "Delete service" button that opens a dialog requiring the user to type the service name to confirm deletion.
- [ ] AC-10: Empty states (no cron jobs configured, no webhook deliveries received yet), loading states, and dark/light themes render seamlessly.

## Tasks
- [ ] T-1: Settings tab layout & sub-navigation (covers AC-1, AC-10)
  - [ ] T-1.1: Build `components/services/settings/settings-nav.tsx` providing desktop vertical section links and mobile responsive pills.
  - [ ] T-1.2: Build `components/services/settings/service-settings-tab.tsx` managing active section state.
- [ ] T-2: General settings panel (covers AC-2)
  - [ ] T-2.1: Build `components/services/settings/general-settings-section.tsx` with inputs for service name, Git branch, Dockerfile path, and build command.
  - [ ] T-2.2: Implement save handler connected to mock `updateService` API with toast confirmation.
- [ ] T-3: Resource limits panel (covers AC-3)
  - [ ] T-3.1: Build `components/services/settings/resource-limits-section.tsx` with CPU, memory, and optional swap inputs.
  - [ ] T-3.2: Integrate `ResourceBar` component displaying current consumption against the entered limit values.
  - [ ] T-3.3: Add informational alert banner: "Resource limits changes apply after service restart".
- [ ] T-4: Cron auxiliary jobs panel (covers AC-4, AC-5, AC-6)
  - [ ] T-4.1: Build `lib/utils/cron-explainer.ts` utility providing human-readable explanations and calculating the next 5 execution timestamps.
  - [ ] T-4.2: Build `components/services/settings/cron-job-table.tsx` with job status toggles, schedule formatting, and "Run now" actions.
  - [ ] T-4.3: Build `components/services/settings/cron-job-dialog.tsx` for adding and editing jobs with real-time cron expression validation and next 5 runs preview.
  - [ ] T-4.4: Build `components/services/settings/cron-job-history-dialog.tsx` displaying run logs, execution durations, and exit codes.
- [ ] T-5: Webhook deployment panel (covers AC-7, AC-8)
  - [ ] T-5.1: Build `components/services/settings/webhook-section.tsx` showing the masked webhook URL, copy button, and regenerate token flow.
  - [ ] T-5.2: Build trigger event checkboxes (push to branch, new tag, manual trigger).
  - [ ] T-5.3: Build `components/services/settings/webhook-deliveries-table.tsx` showing delivery timestamp, trigger event, status badge, and payload modal.
- [ ] T-6: Danger zone panel (covers AC-9)
  - [ ] T-6.1: Build `components/services/settings/danger-zone-section.tsx` with high-contrast destructive styling.
  - [ ] T-6.2: Build `components/services/settings/delete-service-dialog.tsx` with service name confirmation input before deletion.

## Blocking and risks
- Blocking: `03-service-detail` (provides service context and data loading).
- Risks: Complex cron scheduling validation; mitigated using a lightweight native regex or small standard cron parser helper.
- Ponytail note: Avoid large cron parsing packages; a simple regex-backed 5-field parser with a lookup for standard intervals (hourly, daily, weekly) handles the UI preview cleanly.

## Notes
- 2026-10-05: Grouped all service configuration controls into a structured sub-navigation layout to maintain clarity.
