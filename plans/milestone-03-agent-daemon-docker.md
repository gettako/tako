# Milestone 03: Agent Daemon & Docker Engine Integration

---
- **ID**: `M03`
- **Status**: `completed`
- **Blocking**: `[M02]`
- **Target**: Build worker `agent` daemon communicating directly with local Docker Engine (`/var/run/docker.sock`), collecting host performance metrics (CPU, RAM, Disk), registering nodes with the Master Server, and sending periodic heartbeats over gRPC.
---

## Acceptance Criteria
- [x] Agent binary runs as standalone daemon with idle memory footprint < 35 MB.
- [x] Reads local Docker Daemon status via `/var/run/docker.sock` (Docker version, running containers, memory info).
- [x] Collects accurate host system metrics (CPU % usage, Memory % usage, Disk % usage) without external dependencies.
- [x] Performs node registration handshake with Master on initial launch using Enrollment Token.
- [x] Sends `HeartbeatRequest` packets every 3–5 seconds to Master Server.
- [x] Handles graceful shutdown (`SIGTERM`, `SIGINT`) cleanly.

## Checklist
- [x] **Docker Engine Client (`agent/internal/docker/`)**:
  - [x] Install official SDK `github.com/docker/docker/client`
  - [x] Create wrapper for `Ping()`, `ServerVersion()`, `ContainerList()`, and `Info()`
  - [x] Test Docker client connection against local socket
- [x] **Host Telemetry & Metrics (`agent/internal/metrics/`)**:
  - [x] Implement CPU, Memory, Disk collectors using `github.com/shirou/gopsutil/v4`
  - [x] Format metric data into protobuf struct `HeartbeatRequest`
- [x] **Enrollment & Registration Flow**:
  - [x] Implement CLI flags and env vars on Agent: `TAKO_SERVER_ADDR`, `TAKO_ENROLL_TOKEN`, `TAKO_NODE_NAME`
  - [x] Initial registration handshake (`RegisterNodeRequest`) with Master Server
  - [x] Persist local state (`node_id`) in `/data/agent.json`
- [x] **Heartbeat Ticker Loop**:
  - [x] Implement goroutine ticker (default 3s interval)
  - [x] Call gRPC `Heartbeat(ctx, req)` with current timestamp and host metrics
  - [x] Handle errors & disconnects: log warnings and enter retry mode without crashing daemon
- [x] **Docker Events Listener**:
  - [x] Listen to `cli.Events()` stream from Docker to monitor container lifecycle events
