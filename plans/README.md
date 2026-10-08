# Tako Architecture & Implementation Roadmap

This document summarizes the milestone status and dependency graph for the backend (`server`), `agent`, and integration with `console` (Next.js) & `traefik`.

---

## Status Matrix

| Milestone | Name | Status | Blocking / Dependencies |
| :--- | :--- | :---: | :--- |
| [M01](milestone-01-core-scaffold-db.md) | Core Scaffold & Database Layer | `completed` | `[]` |
| [M02](milestone-02-proto-grpc-contract.md) | Protocol Buffers & gRPC Contract | `completed` | `[M01]` |
| [M03](milestone-03-agent-daemon-docker.md) | Agent Daemon & Docker Engine Integration | `completed` | `[M02]` |
| [M04](milestone-04-server-orchestrator-sse.md) | Master Node Orchestrator & Realtime SSE | `completed` | `[M01, M03]` |
| [M05](milestone-05-traefik-proxy-integration.md) | Traefik Reverse Proxy & Network Routing | `completed` | `[M03]` |
| [M06](milestone-06-service-deployment-pipeline.md) | Service Lifecycle & Deployment Pipeline | `completed` | `[M04, M05]` |
| [M07](milestone-07-console-bff-integration.md) | Console Next.js BFF & SSE Wiring | `completed` | `[M06]` |
| [M08](milestone-08-production-compose-distribution.md) | Compose Orchestration & Node Installer Script | `completed` | `[M07]` |
| [M09](milestone-09-mintlify-docs-openapi.md) | Mintlify Documentation & OpenAPI Specification | `completed` | `[M01, M08]` |

---

## Milestone Execution Rules
1. **Status Lifecycle:** `pending` ➔ `todo` ➔ `on-progress` ➔ `completed`.
2. **Blocking Dependency:** A milestone cannot begin (`on-progress`) if dependencies in the `blocking` field are not `completed`.
3. **Checklist Rule:** Each checklist item must be verified functionally before being marked `[x]`.
4. **Acceptance Criteria:** All acceptance criteria must pass functional tests before milestone status transitions to `completed`.

---

## Container Naming Standards & Port Allocation

### 1. Primary Master Server (Master Node):
- `tako-console`: Frontend Next.js dashboard on port **`3000:3000`** (direct access via `http://<IP>:3000`). Application traffic isolates to 80/443.
- `tako-traefik`: Public reverse proxy on ports **`80:80` & `443:443`** (dedicated to routing user applications, with low-priority console fallback).
- `tako-server`: Master control plane, Go API, SQLite DB, gRPC Hub on port **`50051:50051`** (direct gRPC for `tako-agent`).
- `tako-agent`: Local node agent daemon (allows the master node to also host user application containers).

### 2. Worker Nodes:
- `tako-traefik`: Local reverse proxy on ports **`80:80` & `443:443`** for routing application container domains on that worker.
- `tako-agent`: Node agent daemon connected outbound to the master server via gRPC (`<MASTER_IP>:50051`).
