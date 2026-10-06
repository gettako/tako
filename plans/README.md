# Tako Architecture & Implementation Roadmap

Dokumen ini adalah ringkasan status dan dependency graph untuk seluruh milestone backend (`server`), `agent`, dan integrasi dengan `console` (Next.js) & `traefik`.

---

## Status Matrix

| Milestone | Nama | Status | Blocking / Dependencies |
| :--- | :--- | :---: | :--- |
| [M01](plans/milestone-01-core-scaffold-db.md) | Core Scaffold & Database Layer | `completed` | `[]` |
| [M02](plans/milestone-02-proto-grpc-contract.md) | Protocol Buffers & gRPC Contract | `completed` | `[M01]` |
| [M03](plans/milestone-03-agent-daemon-docker.md) | Agent Daemon & Docker Engine Integration | `completed` | `[M02]` |
| [M04](plans/milestone-04-server-orchestrator-sse.md) | Master Node Orchestrator & Realtime SSE | `completed` | `[M01, M03]` |
| [M05](plans/milestone-05-traefik-proxy-integration.md) | Traefik Reverse Proxy & Network Routing | `completed` | `[M03]` |
| [M06](plans/milestone-06-service-deployment-pipeline.md) | Service Lifecycle & Deployment Pipeline | `completed` | `[M04, M05]` |
| [M07](plans/milestone-07-console-bff-integration.md) | Console Next.js BFF & SSE Wiring | `completed` | `[M06]` |
| [M08](plans/milestone-08-production-compose-distribution.md) | Compose Orchestration & Node Installer Script | `completed` | `[M07]` |
| [M09](plans/milestone-09-mintlify-docs-openapi.md) | Mintlify Documentation & OpenAPI Specification | `completed` | `[M01, M08]` |

---

## Aturan Eksekusi Milestone
1. **Status Lifecycle:** `pending` ➔ `todo` ➔ `on-progress` ➔ `completed`.
2. **Blocking Dependency:** Milestone tidak boleh dimulai (`on-progress`) jika dependensi di field `blocking` belum `completed`.
3. **Checklist Rule:** Setiap item pada `Checklist` wajib diverifikasi fungsinya sebelum ditandai `[x]`.
4. **Acceptance Criteria:** Seluruh kriteria penerimaan harus lolos pengujian fungsional sebelum status milestone diubah menjadi `completed`.

---

## Standar Penamaan Container & Alokasi Port

### 1. Server Utama (Master Node):
- `tako-console`: Frontend Next.js dashboard di port **`3000:3000`** (Akses langsung via `http://<IP>:3000`). **DILARANG di-bind langsung ke port 80/443** agar tidak bentrok atau membingungkan saat user deploy aplikasi.
- `tako-traefik`: Reverse proxy publik di port **`80:80` & `443:443`** (MURNI didedikasikan untuk routing domain aplikasi yang di-deploy user, atau custom domain console jika user menyetelnya via domain).
- `tako-server`: Master control plane, Go API, DB SQLite, gRPC Hub di port **`50051:50051`** (Direct gRPC untuk `tako-agent`).
- `tako-agent`: Local node agent daemon (memungkinkan master node juga menghosting app container).

### 2. Server Node (Worker Node):
- `tako-traefik`: Reverse proxy lokal di port **`80:80` & `443:443`** untuk routing domain app container di worker tersebut.
- `tako-agent`: Node agent daemon terhubung outbound ke master via gRPC (`<IP_MASTER>:50051`).


