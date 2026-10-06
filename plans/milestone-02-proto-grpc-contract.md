# Milestone 02: Protocol Buffers & gRPC Contract

---
- **ID**: `M02`
- **Status**: `todo`
- **Blocking**: `[M01]`
- **Target**: Merancang kontrak komunikasi gRPC antara Master Server dan Agent Node. Mendefinisikan protobuf untuk pendaftaran node, heartbeat/telemetry, dispatch perintah deployment, dan streaming log. Menyediakan gRPC server di Master dan gRPC client dengan auto-reconnect di Agent.
---

## Acceptance Criteria
- [ ] Protobuf definitions terdefinisi rapi di direktori `proto/tako/v1/`.
- [ ] Tooling kompilasi Protobuf (`buf` atau `protoc`) menghasilkan Go types & gRPC client/server stubs.
- [ ] Server mengaktifkan gRPC Server (default `:50051`) dengan interceptor autentikasi Bearer Token / Agent Secret.
- [ ] Agent dapat melakukan koneksi gRPC outbound ke Master, melakukan handshake pendaftaran, dan mengirim periodic ping/heartbeat.
- [ ] Ketika koneksi gRPC terputus (misal Master restart), Agent otomatis melakukan reconnect secara resilient (exponential backoff).

## Checklist
- [ ] **Protobuf Definitions (`proto/tako/v1/`)**:
  - [ ] `agent.proto`: Pesan `RegisterNodeRequest`, `RegisterNodeResponse`, `HeartbeatRequest`, `HeartbeatResponse`
  - [ ] `deployment.proto`: Pesan `DeployRequest`, `DeployLogChunk`, `DeploymentStatusUpdate`
  - [ ] `container.proto`: Pesan `ListContainersRequest`, `ContainerActionRequest` (start, stop, restart)
- [ ] **Protobuf Code Generation**:
  - [ ] Konfigurasi `buf.yaml` dan `buf.gen.yaml` (atau script `protoc`)
  - [ ] Generate package Go gRPC stub ke `proto/gen/go/tako/v1/`
- [ ] **Master gRPC Server**:
  - [ ] Implementasi gRPC server listener di `server/internal/grpc/`
  - [ ] Implementasi Authentication Interceptor untuk validasi `metadata["authorization"]` atau header token agent
  - [ ] Daftarkan stub service `AgentServiceServer` dan `DeploymentServiceServer`
- [ ] **Agent gRPC Client**:
  - [ ] Inisialisasi `agent/go.mod`
  - [ ] Implementasi gRPC client di `agent/internal/client/`
  - [ ] Konfigurasi `grpc.WithTransportCredentials` (Insecure untuk local/internal, TLS untuk production)
  - [ ] Tambahkan dial options: keepalive, retry policy, reconnect backoff
  - [ ] Buat unit/integration test koneksi agent ke master gRPC server
