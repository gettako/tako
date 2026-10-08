# Milestone 02: Protocol Buffers & gRPC Contract

---
- **ID**: `M02`
- **Status**: `completed`
- **Blocking**: `[M01]`
- **Target**: Design gRPC communication contracts between Master Server and Agent Node. Define protocol buffers for node registration, heartbeat/telemetry, deployment dispatch, and log streaming. Provide gRPC server on Master and auto-reconnecting gRPC client on Agent.
---

## Acceptance Criteria
- [x] Protobuf definitions structured in `proto/tako/v1/`.
- [x] Protobuf tooling generates Go types & gRPC client/server stubs.
- [x] Master enables gRPC Server (default `:50051`) with Bearer Token / Agent Secret authentication interceptors.
- [x] Agent establishes outbound gRPC connection to Master, performs registration handshake, and sends periodic heartbeats.
- [x] Resilient auto-reconnect with exponential backoff when gRPC connection disconnects.

## Checklist
- [x] **Protobuf Definitions (`proto/tako/v1/`)**:
  - [x] `agent.proto`: `RegisterNodeRequest`, `RegisterNodeResponse`, `HeartbeatRequest`, `HeartbeatResponse`, `StreamTasks`
  - [x] `deployment.proto`: `DeployRequest`, `DeployLogChunk`, `DeploymentStatusUpdate`
  - [x] `container.proto`: `ListContainersRequest`, `ContainerActionRequest` (start, stop, restart, remove)
- [x] **Protobuf Code Generation**:
  - [x] Configure code generation scripts
  - [x] Generate Go gRPC stubs into `proto/gen/go/tako/v1/`
- [x] **Master gRPC Server**:
  - [x] Implement gRPC server listener in `server/internal/grpc/`
  - [x] Implement Authentication Interceptors validating `metadata["authorization"]`
  - [x] Register `AgentServiceServer`, `DeploymentServiceServer`, and `ContainerServiceServer` stubs
- [x] **Agent gRPC Client**:
  - [x] Initialize `agent/go.mod`
  - [x] Implement gRPC client in `agent/internal/client/`
  - [x] Configure transport credentials (Insecure for local/internal, TLS for production)
  - [x] Add dial options: keepalive, retry policy, reconnect backoff
  - [x] Unit/integration tests for agent-to-master gRPC communication
