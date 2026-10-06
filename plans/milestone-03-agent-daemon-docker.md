# Milestone 03: Agent Daemon & Docker Engine Integration

---
- **ID**: `M03`
- **Status**: `todo`
- **Blocking**: `[M02]`
- **Target**: Membangun daemon worker `agent` yang berkomunikasi langsung dengan Docker Engine lokal (`/var/run/docker.sock`), mengumpulkan metrik performa host (CPU, RAM, Disk), mendaftarkan node ke Master Server, dan mengirimkan heartbeat periodik via gRPC.
---

## Acceptance Criteria
- [ ] Agent binary berjalan sebagai standalone daemon dengan footprint memori idle < 35 MB.
- [ ] Berhasil membaca status Docker Daemon lokal via `/var/run/docker.sock` (Docker version, running containers, memory info).
- [ ] Mengumpulkan metrik sistem host secara akurat (CPU % usage, Memory % usage, Disk % usage) tanpa external dependencies.
- [ ] Melakukan handshake pendaftaran node ke Master saat pertama kali dijalankan dengan Enrollment Token.
- [ ] Mengirimkan paket `HeartbeatRequest` setiap interval 3–5 detik ke Master Server.
- [ ] Menangani graceful shutdown (`SIGTERM`, `SIGINT`) dengan mengirimkan notifikasi disconnect ke Master.

## Checklist
- [ ] **Docker Engine Client (`agent/internal/docker/`)**:
  - [ ] Pasang official SDK `github.com/docker/docker/client`
  - [ ] Buat wrapper untuk `Ping()`, `ServerVersion()`, `ContainerList()`, dan `Info()`
  - [ ] Uji koneksi Docker client terhadap socket lokal
- [ ] **Host Telemetry & Metrics (`agent/internal/metrics/`)**:
  - [ ] Implementasi collector CPU, Memory, Disk menggunakan `github.com/shirou/gopsutil/v4` (atau pure-Go sysinfo)
  - [ ] Format data metrik ke dalam struct protobuf `NodeMetrics`
- [ ] **Enrollment & Registration Flow**:
  - [ ] Implementasi CLI flags/env vars pada Agent: `--master-url`, `--token`, `--node-name`
  - [ ] Handshake pendaftaran pertama kali (`RegisterNodeRequest`) ke Master Server
  - [ ] Simpan `node_id` lokal di file state (misal: `/etc/tako/agent.json` atau direct memory)
- [ ] **Heartbeat Ticker Loop**:
  - [ ] Implementasi goroutine ticker (interval configurable, default 3s)
  - [ ] Panggil gRPC `Heartbeat(ctx, req)` membawa timestamp & metrik terbaru
  - [ ] Handle error & disconnect: jika gagal, catat log warn dan masuk ke mode retry tanpa terminate agent process
- [ ] **Docker Events Listener**:
  - [ ] Dengarkan stream `cli.Events()` dari Docker untuk mendeteksi event `container:die`, `container:start`, `container:oom`
