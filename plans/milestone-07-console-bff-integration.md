# Milestone 07: Console Next.js BFF & SSE Wiring

---
- **ID**: `M07`
- **Status**: `completed`
- **Blocking**: `[M06]`
- **Target**: Connect Next.js Console with Go Master Server using the Backend-For-Frontend (BFF) pattern. All browser requests are proxied via same-origin route handlers, preserving tokens in HttpOnly cookies, and piping SSE streams for real-time node telemetry and live deployment logs.
---

## Acceptance Criteria
- [x] Browser never calls Go Master Server directly; all requests flow through same-origin Next.js BFF (`/api/...`).
- [x] Next.js BFF securely proxies requests to internal Go Server (`http://server:8080`).
- [x] Session authentication handled via `HttpOnly` Cookies (protecting against XSS).
- [x] Nodes view (`/nodes`) displays live node telemetry (CPU, RAM, Disk, Network) updating via SSE without page refresh.
- [x] Service Deploy trigger streams real-time build output via SSE to log viewer drawer.
- [x] "Add Node / Enroll" dialog displays copyable curl one-line installer command with generated enrollment token.

## Checklist
- [x] **BFF Client & HTTP Transport (`console/lib/api-client.ts`)**:
  - [x] Type-safe internal fetcher targeting Go Server (`http://server:8080/api/v1`)
  - [x] Standardized error handling and unified response formats
- [x] **Route Handlers / Server Actions (`console/app/api/`)**:
  - [x] Auth endpoints (`/api/auth/login`, `/api/auth/logout`, `/api/auth/me`) with HttpOnly cookies
  - [x] Nodes proxy (`/api/nodes`, `/api/nodes/enroll-token`)
  - [x] Services & Deploy proxy (`/api/services`, `/api/services/[id]/deploy`)
- [x] **SSE Streaming Route Handlers**:
  - [x] `GET /api/sse/nodes`: Pipe node SSE stream from Go Server to browser using `ReadableStream`
  - [x] `GET /api/sse/deployments/[id]/logs`: Pipe real-time build logs to log viewer
- [x] **Frontend React Hooks & UI Integration**:
  - [x] `useNodeEvents()` hook using Web standard `EventSource` for automatic UI node updates
  - [x] `useDeploymentLogs(deploymentId)` hook for real-time log viewer streaming
  - [x] Wire "Add Node" dialog to display installation commands
  - [x] Wire deploy triggers across Service views
