# Milestone 03: Agent Daemon & Docker Engine Integration

---
- **ID**: `M03`
- **Status**: `completed`
- **Blocking**: `[M02]`
- **Target**: Membangun daemon worker `agent` yang berkomunikasi langsung dengan Docker Engine lokal (`/var/run/docker.sock`), mengumpulkan metrik performa host (CPU, RAM, Disk), mendaftarkan node ke Master Server, dan mengirimkan heartbeat periodik via gRPC.
---

## Acceptance Criteria
- [x] Agent binary berjalan sebagai standalone daemon dengan footprint memori idle < 35 MB.
- [x] Berhasil membaca status Docker Daemon lokal via `/var/run/docker.sock` (Docker version, running containers, memory info).
- [x] Mengumpulkan metrik sistem host secara akurat (CPU % usage, Memory % usage, Disk % usage) tanpa external dependencies.
- [x] Melakukan handshake pendaftaran node ke Master saat pertama kali dijalankan dengan Enrollment Token.
- [x] Mengirimkan paket `HeartbeatRequest` setiap interval 3–5 detik ke Master Server.
- [x] Menangani graceful shutdown (`SIGTERM`, `SIGINT`) dengan mengirimkan notifikasi disconnect ke Master.

## Checklist
- [x] **Docker Engine Client (`agent/internal/docker/`)**:
  - [x] Pasang official SDK `github.com/docker/docker/client`
  - [x] Buat wrapper untuk `Ping()`, `ServerVersion()`, `ContainerList()`, dan `Info()`
  - [x] Uji koneksi Docker client terhadap socket lokal
- [x] **Host Telemetry & Metrics (`agent/internal/metrics/`)**:
  - [x] Implementasi collector CPU, Memory, Disk menggunakan `github.com/shirou/gopsutil/v4`
  - [x] Format data metrik ke dalam struct protobuf `NodeMetrics` / `HeartbeatRequest`
- [x] **Enrollment & Registration Flow**:
  - [x] Implementasi CLI flags/env vars pada Agent: `--master-url`, `--token`, `--node-name`
  - [x] Handshake pendaftaran pertama kali (`RegisterNodeRequest`) ke Master Server
  - [x] Simpan `node_id` lokal di file state (misal: `/etc/tako/agent.json` atau direct memory)
- [x] **Heartbeat Ticker Loop**:
  - [x] Implementasi goroutine ticker (interval configurable, default 3s)
  - [x] Panggil gRPC `Heartbeat(ctx, req)` membawa timestamp & metrik terbaru
  - [x] Handle error & disconnect: jika gagal, catat log warn dan masuk ke mode retry tanpa terminate agent process
- [x] **Docker Events Listener**:
  - [x] Dengarkan stream `cli.Events()` dari Docker untuk mendeteksi event `container:die`, `container:start`, `container:oom`
