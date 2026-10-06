# Milestone 06: Service Lifecycle & Deployment Pipeline

---
- **ID**: `M06`
- **Status**: `completed`
- **Blocking**: `[M04, M05]`
- **Target**: Membangun pipeline deployment end-to-end: pembuatan service di Master, trigger deploy via API, dispatch perintah deploy via gRPC ke target Agent node, eksekusi Docker build/pull oleh Agent, pelabelan Traefik, dan streaming live logs secara real-time dari Agent kembali ke Master.
---

## Acceptance Criteria
- [x] Master Server memiliki API CRUD Service (nama, project_id, target node_id, image/git repo, environment variables, exposed ports, domain).
- [x] Endpoint `POST /api/v1/services/{id}/deploy` memicu deployment baru dan mengembalikan `deployment_id` instan.
- [x] Master mengirimkan `DeployRequest` ke Agent target yang terhubung via gRPC stream.
- [x] Agent melakukan:
  1. Pull image atau Build dari Dockerfile.
  2. Setup container dengan environment variables & limit resource.
  3. Menyematkan label Traefik untuk routing domain otomatis.
  4. Menjalankan container di bridge network `tako-network`.
- [x] Agent mengirimkan potongan log build/run ke Master via gRPC stream (`DeployLogChunk`).
- [x] Master menyediakan endpoint SSE `GET /api/v1/deployments/{id}/logs` yang menyalurkan live log ke subscriber.

## Checklist
- [x] **Service & Deployment Domain Models (`server/internal/domain/` / `orchestrator/`)**:
  - [x] Implementasi tabel dan SQLC queries untuk `services` dan `deployments`
  - [x] State machine deployment: `queued` ➔ `building` ➔ `deploying` ➔ `running` (atau `failed` / `cancelled`)
- [x] **Master Deployment Orchestrator (`server/internal/orchestrator/`)**:
  - [x] Buat `DeploymentService` di Master
  - [x] Validasi ketersediaan target Agent (cek status online dan channel gRPC aktif)
  - [x] Buat buffer log deployment di SQLite / memory buffer
  - [x] Handle penerimaan log chunk dari gRPC stream dan broadcast ke Event Bus
- [x] **Agent Deployment Executor (`agent/internal/deploy/`)**:
  - [x] Implementasi handler `ExecuteDeploy` di Agent
  - [x] Image deployment: `docker.ImagePull()` dengan progress logger
  - [x] Git/Dockerfile deployment: Git clone ke temporary directory dan trigger `docker.ImageBuild()`
  - [x] Container setup: `docker.ContainerCreate()` dengan labels Traefik, env vars, restart policy `unless-stopped`
  - [x] Mulai container: `docker.ContainerStart()` dan healthcheck inspection
  - [x] Stream log stdout/stderr selama proses berlangsung ke gRPC stream
- [x] **Live Logs Streaming API**:
  - [x] Endpoint REST `GET /api/v1/deployments/{id}` (info status deployment)
  - [x] Endpoint SSE `GET /api/v1/deployments/{id}/logs` (stream log real-time)
  - [x] Endpoint REST `GET /api/v1/deployments/{id}/logs/history` (download log lengkap yang sudah selesai)
- [x] **Service Operations (Lifecycle)**:
  - [x] Restart, Stop, Start, dan Delete container via gRPC RPC commands dari Master ke Agent
