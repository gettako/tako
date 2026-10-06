# Milestone 04: Master Node Orchestrator & Realtime SSE

---
- **ID**: `M04`
- **Status**: `todo`
- **Blocking**: `[M01, M03]`
- **Target**: Membangun orkestrator node di Master Server, sistem manajemen status node (online/offline state machine), event bus pub-sub in-memory di Go, REST API untuk manajemen node, dan endpoint Server-Sent Events (SSE) untuk streaming status dan metrik ke Next.js Console.
---

## Acceptance Criteria
- [ ] Master Server dapat menerima pendaftaran agent baru menggunakan Enrollment Token dan menyimpannya ke database SQLite.
- [ ] Menerima stream heartbeat dari Agent, memperbarui metrik realtime (CPU, RAM, Disk) dan `last_seen_at`.
- [ ] Background worker di Server otomatis menandai node sebagai `offline` jika tidak ada heartbeat selama > 15 detik.
- [ ] Endpoint REST Chi untuk nodes tersedia: `GET /api/v1/nodes`, `POST /api/v1/nodes/enroll-token`, `DELETE /api/v1/nodes/{id}`.
- [ ] Endpoint SSE `GET /api/v1/events/nodes` mem-broadcast event update node secara real-time ke semua klien SSE yang terhubung.

## Checklist
- [ ] **Node Manager & State Machine (`server/internal/orchestrator/`)**:
  - [ ] Implementasi handler `RegisterNode` gRPC dengan validasi token pendaftaran
  - [ ] Implementasi handler `Heartbeat` gRPC: update database SQLite `nodes` dan cache memory
  - [ ] Background goroutine `LivenessWatcher` (interval 5s) untuk mendeteksi node timeout (> 15s) dan transisi status ke `offline`
- [ ] **In-Memory Event Bus (`server/internal/events/`)**:
  - [ ] Buat lightweight pub-sub broker berbasis Go channels
  - [ ] Buat event types: `NodeStatusChangedEvent`, `NodeMetricsEvent`, `DeploymentLogEvent`
  - [ ] Dukungan multiple subscribers dengan non-blocking delivery / buffer
- [ ] **REST API Endpoints (Chi)**:
  - [ ] `POST /api/v1/nodes/enroll-token`: Generate token acak bertanda tangan untuk mendaftarkan worker baru
  - [ ] `GET /api/v1/nodes`: Daftar semua node beserta status, IP, kapasitas CPU/RAM, dan metrik terbaru
  - [ ] `GET /api/v1/nodes/{id}`: Detail node spesifik dan container yang sedang berjalan di node tersebut
  - [ ] `DELETE /api/v1/nodes/{id}`: Hapus node dari cluster
- [ ] **Server-Sent Events (SSE) Handler**:
  - [ ] Implementasi HTTP handler `GET /api/v1/events/nodes` dengan header `text/event-stream`
  - [ ] Subscribe ke Event Bus dan salurkan data JSON event ke response writer
  - [ ] Handle client disconnect (`ctx.Done()`) untuk melepaskan listener secara bersih
  - [ ] Kirimkan initial state snapshot saat klien pertama kali tersambung
