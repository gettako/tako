# Milestone 06: Service Lifecycle & Deployment Pipeline

---
- **ID**: `M06`
- **Status**: `todo`
- **Blocking**: `[M04, M05]`
- **Target**: Membangun pipeline deployment end-to-end: pembuatan service di Master, trigger deploy via API, dispatch perintah deploy via gRPC ke target Agent node, eksekusi Docker build/pull oleh Agent, pelabelan Traefik, dan streaming live logs secara real-time dari Agent kembali ke Master.
---

## Acceptance Criteria
- [ ] Master Server memiliki API CRUD Service (nama, project_id, target node_id, image/git repo, environment variables, exposed ports, domain).
- [ ] Endpoint `POST /api/v1/services/{id}/deploy` memicu deployment baru dan mengembalikan `deployment_id` instan.
- [ ] Master mengirimkan `DeployRequest` ke Agent target yang terhubung via gRPC stream.
- [ ] Agent melakukan:
  1. Pull image atau Build dari Dockerfile.
  2. Setup container dengan environment variables & limit resource.
  3. Menyematkan label Traefik untuk routing domain otomatis.
  4. Menjalankan container di bridge network `tako-network`.
- [ ] Agent mengirimkan potongan log build/run ke Master via gRPC stream (`DeployLogChunk`).
- [ ] Master menyediakan endpoint SSE `GET /api/v1/deployments/{id}/logs` yang menyalurkan live log ke subscriber.

## Checklist
- [ ] **Service & Deployment Domain Models (`server/internal/domain/`)**:
  - [ ] Implementasi tabel dan SQLC queries untuk `services` dan `deployments`
  - [ ] State machine deployment: `queued` ➔ `building` ➔ `deploying` ➔ `running` (atau `failed` / `cancelled`)
- [ ] **Master Deployment Orchestrator (`server/internal/orchestrator/`)**:
  - [ ] Buat `DeploymentService` di Master
  - [ ] Validasi ketersediaan target Agent (cek status online dan channel gRPC aktif)
  - [ ] Buat buffer log deployment di SQLite / memory buffer
  - [ ] Handle penerimaan log chunk dari gRPC stream dan broadcast ke Event Bus
- [ ] **Agent Deployment Executor (`agent/internal/deploy/`)**:
  - [ ] Implementasi handler `ExecuteDeploy` di Agent
  - [ ] Image deployment: `docker.ImagePull()` dengan progress logger
  - [ ] Git/Dockerfile deployment: Git clone ke temporary directory dan trigger `docker.ImageBuild()`
  - [ ] Container setup: `docker.ContainerCreate()` dengan labels Traefik, env vars, restart policy `unless-stopped`
  - [ ] Mulai container: `docker.ContainerStart()` dan healthcheck inspection
  - [ ] Stream log stdout/stderr selama proses berlangsung ke gRPC stream
- [ ] **Live Logs Streaming API**:
  - [ ] Endpoint REST `GET /api/v1/deployments/{id}` (info status deployment)
  - [ ] Endpoint SSE `GET /api/v1/deployments/{id}/logs` (stream log real-time)
  - [ ] Endpoint REST `GET /api/v1/deployments/{id}/logs/history` (download log lengkap yang sudah selesai)
- [ ] **Service Operations (Lifecycle)**:
  - [ ] Restart, Stop, Start, dan Delete container via gRPC RPC commands dari Master ke Agent
