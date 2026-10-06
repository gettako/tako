# Milestone 02: Protocol Buffers & gRPC Contract

---
- **ID**: `M02`
- **Status**: `completed`
- **Blocking**: `[M01]`
- **Target**: Merancang kontrak komunikasi gRPC antara Master Server dan Agent Node. Mendefinisikan protobuf untuk pendaftaran node, heartbeat/telemetry, dispatch perintah deployment, dan streaming log. Menyediakan gRPC server di Master dan gRPC client dengan auto-reconnect di Agent.
---

## Acceptance Criteria
- [x] Protobuf definitions terdefinisi rapi di direktori `proto/tako/v1/`.
- [x] Tooling kompilasi Protobuf (`buf` atau `protoc`) menghasilkan Go types & gRPC client/server stubs.
- [x] Server mengaktifkan gRPC Server (default `:50051`) dengan interceptor autentikasi Bearer Token / Agent Secret.
- [x] Agent dapat melakukan koneksi gRPC outbound ke Master, melakukan handshake pendaftaran, dan mengirim periodic ping/heartbeat.
- [x] Ketika koneksi gRPC terputus (misal Master restart), Agent otomatis melakukan reconnect secara resilient (exponential backoff).

## Checklist
- [x] **Protobuf Definitions (`proto/tako/v1/`)**:
  - [x] `agent.proto`: Pesan `RegisterNodeRequest`, `RegisterNodeResponse`, `HeartbeatRequest`, `HeartbeatResponse`
  - [x] `deployment.proto`: Pesan `DeployRequest`, `DeployLogChunk`, `DeploymentStatusUpdate`
  - [x] `container.proto`: Pesan `ListContainersRequest`, `ContainerActionRequest` (start, stop, restart)
- [x] **Protobuf Code Generation**:
  - [x] Konfigurasi script `protoc`
  - [x] Generate package Go gRPC stub ke `proto/gen/go/tako/v1/`
- [x] **Master gRPC Server**:
  - [x] Implementasi gRPC server listener di `server/internal/grpc/`
  - [x] Implementasi Authentication Interceptor untuk validasi `metadata["authorization"]` atau header token agent
  - [x] Daftarkan stub service `AgentServiceServer` dan `DeploymentServiceServer`
- [x] **Agent gRPC Client**:
  - [x] Inisialisasi `agent/go.mod`
  - [x] Implementasi gRPC client di `agent/internal/client/`
  - [x] Konfigurasi `grpc.WithTransportCredentials` (Insecure untuk local/internal, TLS untuk production)
  - [x] Tambahkan dial options: keepalive, retry policy, reconnect backoff
  - [x] Buat unit/integration test koneksi agent ke master gRPC server
