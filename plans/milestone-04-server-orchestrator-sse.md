# Milestone 04: Master Node Orchestrator & Realtime SSE

---
- **ID**: `M04`
- **Status**: `completed`
- **Blocking**: `[M01, M03]`
- **Target**: Build node orchestrator in Master Server, node status management (online/offline state machine), in-memory Go pub-sub event bus, REST API for node management, and Server-Sent Events (SSE) endpoints for streaming node status and metrics to the Console.
---

## Acceptance Criteria
- [x] Master Server accepts new agent registrations via Enrollment Token and saves to SQLite.
- [x] Receives heartbeat streams from Agent, updating real-time metrics (CPU, RAM, Disk) and `last_seen_at`.
- [x] Server background worker automatically flags nodes as `offline` if no heartbeat is received for > 15 seconds.
- [x] Chi REST endpoints for nodes available: `GET /api/v1/nodes`, `POST /api/v1/nodes/enroll-token`, `DELETE /api/v1/nodes/{id}`.
- [x] SSE endpoint `GET /api/v1/events/nodes` broadcasts real-time node update events to all connected clients.

## Checklist
- [x] **Node Manager & State Machine (`server/internal/orchestrator/`)**:
  - [x] Implement gRPC `RegisterNode` handler with token validation
  - [x] Implement gRPC `Heartbeat` handler: update SQLite `nodes` table and memory cache
  - [x] Background goroutine `LivenessWatcher` (5s interval) detecting node timeouts (> 15s) and transitioning status to `offline`
- [x] **In-Memory Event Bus (`server/internal/events/`)**:
  - [x] Build lightweight channel-based pub-sub broker
  - [x] Event types: `EventNodeStatusChanged`, `EventNodeMetrics`, `EventDeploymentLog`
  - [x] Multi-subscriber support with buffered, non-blocking delivery
- [x] **REST API Endpoints (Chi)**:
  - [x] `POST /api/v1/nodes/enroll-token`: Generate secure enrollment token
  - [x] `GET /api/v1/nodes`: List all nodes with status, specs, and telemetry
  - [x] `GET /api/v1/nodes/{id}`: Detailed node status
  - [x] `DELETE /api/v1/nodes/{id}`: Unenroll node
- [x] **Server-Sent Events (SSE) Handler**:
  - [x] Implement `GET /api/v1/events/nodes` with `text/event-stream` headers
  - [x] Subscribe to Event Bus and stream JSON event payloads
  - [x] Handle client disconnect (`ctx.Done()`) cleanly
  - [x] Send initial snapshot state on first connect
