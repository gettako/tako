# Milestone 06: Service Lifecycle & Deployment Pipeline

---
- **ID**: `M06`
- **Status**: `completed`
- **Blocking**: `[M04, M05]`
- **Target**: Build end-to-end deployment pipeline: service creation in Master, deploy trigger via API, deploy dispatch via gRPC to target Agent node, Docker build/pull execution by Agent, dynamic Traefik routing, and real-time live log streaming from Agent back to Master.
---

## Acceptance Criteria
- [x] Master Server provides CRUD API for Services (name, project_id, target node_id, image/git repo, environment variables, exposed ports, domains).
- [x] `POST /api/v1/services/{id}/deploy` triggers new deployment and returns immediate `deployment_id`.
- [x] Master dispatches `DeployRequest` to target Agent via gRPC stream.
- [x] Agent executes:
  1. Image pull or Dockerfile build.
  2. Container setup with environment variables & resource limits.
  3. Dynamic Traefik YAML configuration generation for automated routing.
  4. Launches container on `tako-network` bridge network.
- [x] Agent streams build/run log chunks to Master via gRPC stream (`DeployLogChunk`).
- [x] Master provides SSE endpoint `GET /api/v1/deployments/{id}/logs` streaming live output to subscribers.

## Checklist
- [x] **Service & Deployment Domain Models (`server/internal/orchestrator/`)**:
  - [x] Tables and SQLC queries for `services` and `deployments`
  - [x] 7-step deployment lifecycle: `queued` ➔ `clone` ➔ `build` ➔ `push_load` ➔ `deploy` ➔ `health_check` ➔ `live` (or `failed`)
- [x] **Master Deployment Orchestrator (`server/internal/orchestrator/`)**:
  - [x] Validate target Agent readiness (online status and active gRPC session)
  - [x] Buffer deployment logs in SQLite and memory
  - [x] Receive log chunks from gRPC and broadcast to Event Bus
- [x] **Agent Deployment Executor (`agent/internal/deploy/`)**:
  - [x] Handler for deployment tasks on Agent
  - [x] Registry image deployment: `docker.ImagePull()` with progress logger
  - [x] Git/Dockerfile deployment: Git clone to temporary directory and trigger `docker.ImageBuild()`
  - [x] Container setup: `docker.ContainerCreate()` with Traefik labels, env vars, restart policy `unless-stopped`
  - [x] Container start: `docker.ContainerStart()` and healthcheck inspection
  - [x] Stream stdout/stderr logs over gRPC during execution
- [x] **Live Logs Streaming API**:
  - [x] REST endpoint `GET /api/v1/deployments/{id}` (status & details)
  - [x] SSE endpoint `GET /api/v1/deployments/{id}/logs` (real-time stream)
  - [x] REST endpoint `GET /api/v1/deployments/{id}/logs/history` (complete historical log)
- [x] **Service Operations (Lifecycle)**:
  - [x] Restart, Stop, Start, and Delete containers via gRPC commands
