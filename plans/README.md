# Tako Architecture & Implementation Roadmap

Dokumen ini adalah ringkasan status dan dependency graph untuk seluruh milestone backend (`server`), `agent`, dan integrasi dengan `console` (Next.js) & `traefik`.

---

## Status Matrix

| Milestone | Nama | Status | Blocking / Dependencies |
| :--- | :--- | :---: | :--- |
| [M01](file:///Users/SupianIDz/Work/gettako/plans/milestone-01-core-scaffold-db.md) | Core Scaffold & Database Layer | `todo` | `[]` |
| [M02](file:///Users/SupianIDz/Work/gettako/plans/milestone-02-proto-grpc-contract.md) | Protocol Buffers & gRPC Contract | `todo` | `[M01]` |
| [M03](file:///Users/SupianIDz/Work/gettako/plans/milestone-03-agent-daemon-docker.md) | Agent Daemon & Docker Engine Integration | `todo` | `[M02]` |
| [M04](file:///Users/SupianIDz/Work/gettako/plans/milestone-04-server-orchestrator-sse.md) | Master Node Orchestrator & Realtime SSE | `todo` | `[M01, M03]` |
| [M05](file:///Users/SupianIDz/Work/gettako/plans/milestone-05-traefik-proxy-integration.md) | Traefik Reverse Proxy & Network Routing | `todo` | `[M03]` |
| [M06](file:///Users/SupianIDz/Work/gettako/plans/milestone-06-service-deployment-pipeline.md) | Service Lifecycle & Deployment Pipeline | `todo` | `[M04, M05]` |
| [M07](file:///Users/SupianIDz/Work/gettako/plans/milestone-07-console-bff-integration.md) | Console Next.js BFF & SSE Wiring | `todo` | `[M06]` |
| [M08](file:///Users/SupianIDz/Work/gettako/plans/milestone-08-production-compose-distribution.md) | Compose Orchestration & Node Installer Script | `todo` | `[M07]` |
| [M09](file:///Users/SupianIDz/Work/gettako/plans/milestone-09-mintlify-docs-openapi.md) | Mintlify Documentation & OpenAPI Specification | `todo` | `[M01, M08]` |

---

## Aturan Eksekusi Milestone
1. **Status Lifecycle:** `pending` ➔ `todo` ➔ `on-progress` ➔ `completed`.
2. **Blocking Dependency:** Milestone tidak boleh dimulai (`on-progress`) jika dependensi di field `blocking` belum `completed`.
3. **Checklist Rule:** Setiap item pada `Checklist` wajib diverifikasi fungsinya sebelum ditandai `[x]`.
4. **Acceptance Criteria:** Seluruh kriteria penerimaan harus lolos pengujian fungsional sebelum status milestone diubah menjadi `completed`.

---

## Standar Penamaan Container Docker

### 1. Server Utama (Master Node):
- `tako-traefik`: Reverse proxy publik (HTTP 80, HTTPS 443, gRPC 50051)
- `tako-server`: Master control plane, Go API, DB SQLite, gRPC Hub
- `tako-console`: Frontend Next.js dashboard
- `tako-agent`: Local node agent daemon (memungkinkan master node juga menghosting app container)

### 2. Server Node (Worker Node):
- `tako-traefik`: Reverse proxy lokal untuk routing app container di worker tersebut
- `tako-agent`: Node agent daemon terhubung outbound ke master via gRPC

