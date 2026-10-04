---
id: 07-account-and-admin
title: Account and Admin
status: todo
blocked_by: [01-foundation]
blocks: [08-polish]
---

## Goal
Implement cluster administration, security, and user management pages: the Audit Logs explorer (`/audit-logs`), the user Profile and Session management center (`/profile`), and the global cluster Settings hub (`/settings`).

## Scope
- Audit Logs page (`/audit-logs`) with category tabs (Auth, Project, Service, Node, Settings), text search, user filter, date range filter, pagination, and expandable event detail drawers.
- Profile page (`/profile`): user details, password change, passkey registration/management, and multi-step TOTP two-factor setup flow with QR code and recovery codes.
- Session management (within `/profile`): active session device list, IP/location tracking, "This session" indicator, single session revocation, and "Log out of all other devices" action.
- Global Settings (`/settings`):
  - Overview panel.
  - Users management (owner/member RBAC, invite link generation with expiration, invite revocation, member deactivation).
  - S3 Buckets configuration (add/edit storage, simulated connection test).
  - Git integration (GitHub App connection, organization accounts, synced repositories list).
  - Backups (Tako internal database backup schedule and manual trigger).
  - Domain (app domain configuration and SSL verification).
  - Notifications (Email, Slack, Telegram channel settings).
- Explicitly out of scope: Live WebAuthn FIDO2 ceremony, real SMTP dispatch, real S3 API network calls, or GitHub OAuth callback handshakes.

## Acceptance criteria
- [ ] AC-1: Audit Logs page `/audit-logs` renders an event table with category tabs (All, Auth, Project, Service, Node, Settings), text search, actor dropdown filter, date picker, and pagination controls.
- [ ] AC-2: Each audit log entry displays timestamp, actor avatar/name, action verb, target resource badge, IP address, and an action to inspect the JSON event metadata in a drawer.
- [ ] AC-3: Profile page `/profile` includes personal profile editing (name, email), password change form with validation, and a Passkey management table (showing key name, created date, last used, and remove action).
- [ ] AC-4: Profile page provides a dedicated TOTP section with an interactive setup modal displaying a simulated QR code, manual secret key with copy button, 6-digit code verification input, and emergency backup codes generator.
- [ ] AC-5: Session management in `/profile` displays a list of active sessions with device/browser icons, IP address, location, last active timestamp, and a distinctive "This session" badge.
- [ ] AC-6: Users can revoke any remote session individually with a confirmation prompt, or click "Log out of all other devices" to revoke all sessions except the current one.
- [ ] AC-7: Global Settings page `/settings` organizes sections using a sidebar navigation on desktop and horizontal scroll tabs on mobile (Overview, Users, Buckets, Git, Backups, Domain, Notifications).
- [ ] AC-8: Settings Users tab renders member list with Owner and Member roles, pending invites, an "Invite user" dialog generating shareable links with expiry (24h, 7d, 30d), revoke invite action, and deactivate user confirmation.
- [ ] AC-9: Settings Buckets tab lists configured S3 buckets and provides an "Add bucket" dialog with a simulated "Test connection" button showing connection latency and success/failure alert.
- [ ] AC-10: Settings Git tab displays connected GitHub accounts and organizations with an action to connect GitHub App, and a list of synced repositories with a manual "Sync now" action.
- [ ] AC-11: Settings Backups, Domain, and Notifications tabs configure Tako self-backup schedules with "Backup now", application hostname with SSL status badge, and channel toggles for Email, Slack webhook, and Telegram bot.
- [ ] AC-12: Loading skeletons, empty states (e.g. no audit logs matching filter, no S3 buckets), error boundaries, and full light/dark theme styling apply across all screens.

## Tasks
- [ ] T-1: Audit Logs page (`/audit-logs`) (covers AC-1, AC-2, AC-12)
  - [ ] T-1.1: Build `components/audit/audit-filters.tsx` with category tabs (All, Auth, Project, Service, Node, Settings), search input, actor selector, and date range picker.
  - [ ] T-1.2: Build `components/audit/audit-table.tsx` with actor avatars, resource tags, IP display, and pagination controls.
  - [ ] T-1.3: Build `components/audit/audit-detail-drawer.tsx` to inspect structured JSON payloads for selected audit entries.
  - [ ] T-1.4: Assemble `app/audit-logs/page.tsx` integrating mock audit queries and empty states.
- [ ] T-2: User Profile security & credentials (`/profile`) (covers AC-3, AC-4, AC-12)
  - [ ] T-2.1: Build `components/profile/profile-info-form.tsx` for updating user name and email.
  - [ ] T-2.2: Build `components/profile/password-change-form.tsx` with current password, new password, and confirmation validation.
  - [ ] T-2.3: Build `components/profile/passkey-manager.tsx` listing registered passkeys with delete action and "Add passkey" simulated registration flow.
  - [ ] T-2.4: Build `components/profile/totp-setup-dialog.tsx` implementing the multi-step 2FA enrollment wizard (QR code, secret key copy, 6-digit verification code, and recovery codes download).
- [ ] T-3: Session management in `/profile` (covers AC-5, AC-6)
  - [ ] T-3.1: Build `components/profile/session-item.tsx` showing browser/OS icon, IP address, location, last active timestamp, and "This session" highlight.
  - [ ] T-3.2: Build `components/profile/session-manager.tsx` with revoke single session action and "Log out of all other devices" bulk revocation dialog.
  - [ ] T-3.3: Assemble `app/profile/page.tsx` organizing profile info, security, 2FA, and active sessions in clear sections.
- [ ] T-4: Settings layout & Overview (`/settings`) (covers AC-7, AC-12)
  - [ ] T-4.1: Build `components/settings/settings-nav.tsx` providing sidebar navigation across all settings panels.
  - [ ] T-4.2: Build `components/settings/overview-panel.tsx` summarizing cluster status, version, and quick admin links.
  - [ ] T-4.3: Set up layout at `app/settings/layout.tsx`.
- [ ] T-5: Settings Users & RBAC (covers AC-8)
  - [ ] T-5.1: Build `components/settings/users-table.tsx` listing members, roles (Owner, Member), pending invite statuses, and role change dropdowns.
  - [ ] T-5.2: Build `components/settings/invite-user-dialog.tsx` generating invite links with expiration duration (24h, 7d, 30d) and copy button.
  - [ ] T-5.3: Build member deactivation confirmation dialog.
- [ ] T-6: Settings Buckets & Git (covers AC-9, AC-10)
  - [ ] T-6.1: Build `components/settings/buckets-panel.tsx` with S3 storage list and "Add bucket" dialog featuring a simulated "Test connection" trigger.
  - [ ] T-6.2: Build `components/settings/git-panel.tsx` showing connected GitHub App status, authorized organizations, and synced repositories list with "Sync now" button.
- [ ] T-7: Settings Backups, Domain & Notifications (covers AC-11)
  - [ ] T-7.1: Build `components/settings/backups-panel.tsx` with automated backup schedule configuration and "Backup now" trigger.
  - [ ] T-7.2: Build `components/settings/domain-panel.tsx` for Tako cluster domain setup with SSL status check.
  - [ ] T-7.3: Build `components/settings/notifications-panel.tsx` with channel toggles and configuration forms for Email, Slack webhook URL, and Telegram bot token.

## Blocking and risks
- Blocking: `01-foundation` (provides layout shell, mock users/audit data, and dialog primitives).
- Risks: Ensuring clean division between Member and Owner permissions in UI components; handled via a simple mock user role switch in the user context.
- Ponytail note: Avoid complex RBAC rule engines or CASL libraries; a simple `role === 'owner'` boolean check is the cleanest, shortest implementation.

## Notes
- 2026-10-05: Grouped admin and security functions into clear, cohesive modular panels.
