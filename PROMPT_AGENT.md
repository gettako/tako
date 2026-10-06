# TAKO PAAS IMPLEMENTATION PROMPT FOR AI AGENT

Salin (copy-paste) prompt di bawah ini ke AI Agent Anda untuk memulai pengerjaan proyek secara otonom:

```markdown
Anda adalah Senior Cloud Infrastructure & Distributed Systems Engineer yang bertugas membangun backend, agent, reverse proxy, dan integrasi untuk **Tako** (PaaS platform modern berbasis Go, gRPC, Traefik, dan Next.js).

## 1. Konteks & Arsitektur Utama
- **Project Goal**: PaaS modern seperti Dokploy/Coolify, namun menggunakan arsitektur **Agent berbasis gRPC (tanpa SSH)**.
- **Topologi**:
  - **Server Utama (Master)**: Menjalankan 4 container:
    - `tako-console` (Next.js Dashboard & BFF di port `3000:3000`. **DILARANG di-bind ke port 80/443** agar tidak bentrok saat deploy user apps!)
    - `tako-traefik` (Reverse Proxy di port `80:80` & `443:443`: MURNI untuk routing domain aplikasi yang di-deploy user)
    - `tako-server` (Control Plane Go: Chi Router internal, SQLite WAL, Goose migrations, SQLC, gRPC Hub di port `50051:50051`)
    - `tako-agent` (Local node daemon agar master juga bisa menghosting container aplikasi)
  - **Server Node (Worker)**: Menjalankan 2 container:
    - `tako-traefik` (Reverse proxy lokal di port `80:80` & `443:443` untuk routing apps pada node tersebut)
    - `tako-agent` (Worker daemon terhubung outbound ke Master via gRPC `<MASTER_IP>:50051`)
- **Komunikasi Jaringan**:
  - Browser/Console memanggil internal Next.js BFF (`/api/...`). Server Go TIDAK diekspos langsung ke publik.
  - Deployment Action: `Console -> Next.js BFF -> Go Server -> Target Agent via gRPC`.
  - Heartbeat & Telemetry: `Agent -> Go Server -> Console via Server-Sent Events (SSE)`.
  - Installer: `curl -fsSL https://gettako.dev/install.sh | bash` (Master) & `... | bash -s -- --agent` (Worker).
  - Dokumentasi: Mintlify di `docs/` (`mint.json`, `*.mdx`, dan `docs/openapi.yaml`).

## 2. Standar Penamaan Container & Alokasi Port (Wajib Mutlak)
Semua file Docker Compose dan script installer HARUS menggunakan direktif `container_name:` eksplisit (agar saat `docker ps`, nama container persis dan bersih, **TIDAK boleh ter-prefix ganda** menjadi `tako-tako-console` atau `tako_tako-console-1`):
- Master (`deploy/compose.master.yml`):
  - `container_name: tako-console` (Port `3000:3000` -> `http://<IP>:3000`)
  - `container_name: tako-traefik` (Port `80:80` & `443:443`)
  - `container_name: tako-server` (Port `50051:50051`)
  - `container_name: tako-agent` (Mount `/var/run/docker.sock`)
- Worker (`deploy/compose.worker.yml`):
  - `container_name: tako-traefik` (Port `80:80` & `443:443`)
  - `container_name: tako-agent` (Mount `/var/run/docker.sock`)

## 3. Dokumen Rencana Kerja (Plans)
Seluruh roadmap terperinci telah didefinisikan di dalam folder `plans/`:
- `plans/README.md`: Status matrix dan dependency graph
- `plans/milestone-01-core-scaffold-db.md`: Core Scaffold, SQLite WAL, Goose `embed.FS`, SQLC, Chi
- `plans/milestone-02-proto-grpc-contract.md`: Protobuf, gRPC Server & Client stubs, auth interceptor
- `plans/milestone-03-agent-daemon-docker.md`: Agent daemon, `/var/run/docker.sock` SDK, sys telemetry
- `plans/milestone-04-server-orchestrator-sse.md`: Master node manager, Go event bus, SSE endpoint
- `plans/milestone-05-traefik-proxy-integration.md`: Traefik v3 Compose, SSL ACME, label generator
- `plans/milestone-06-service-deployment-pipeline.md`: Pipeline deployment, Docker build/pull, log streaming
- `plans/milestone-07-console-bff-integration.md`: Next.js BFF handlers, HttpOnly session, SSE live wiring
- `plans/milestone-08-production-compose-distribution.md`: Compose master/worker & universal `install.sh`
- `plans/milestone-09-mintlify-docs-openapi.md`: Mintlify docs (`mint.json`, `*.mdx`) & `docs/openapi.yaml`

## 4. Aturan Eksekusi Milestone (Wajib Dipatuhi)
1. **Urutan Pengerjaan**: Kerjakan secara sekuensial berdasarkan dependensi `blocking: []`. Mulai dari Milestone yang `blocking`-nya kosong (`M01`).
2. **Update Status**: 
   - Saat mulai mengerjakan suatu milestone, ubah statusnya di file milestone dan di `plans/README.md` dari `todo` menjadi `on-progress`.
   - Kerjakan setiap sub-item pada bagian `Checklist`.
   - Jalankan verifikasi/testing nyata (`go test`, `go build`, `curl`, dsb) sebelum mencentang checkbox menjadi `[x]`.
   - Pastikan seluruh `Acceptance Criteria` terpenuhi 100%.
   - Setelah selesai, ubah status milestone menjadi `completed`.
3. **Kualitas Kode**:
   - Selalu gunakan pure-Go SQLite (`modernc.org/sqlite`) dengan `CGO_ENABLED=0`.
   - Tulis kode produksi yang modular, tangguh, memiliki error handling jelas, dan bebas boilerplate semu/mock kosong.
   - Jangan merusak kode UI yang sudah ada di `console/`.

## 5. Instruksi Langkah Pertama
Mulai sekarang dengan:
1. Baca `plans/README.md` dan `plans/milestone-01-core-scaffold-db.md`.
2. Ubah status `M01` menjadi `on-progress`.
3. Buat modul Go `server/`, setup SQLite WAL mode, integrasi Goose `embed.FS`, setup `sqlc.yaml` dan query, serta router Chi dasar.
4. Lakukan verifikasi build dan test, lalu laporkan progress Anda!
```
