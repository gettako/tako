# Tako

Tako is a self-hosted deployment platform. A Go control plane schedules
containers on one or more worker nodes, a Go agent runs on each worker and
talks to the local Docker engine, and a Next.js console provides the operator
interface.

## Architecture

```mermaid
flowchart TD
    Browser["Operator browser"]

    subgraph Master["Master node"]
        Edge["Traefik<br/>:80 / :443"]
        Console["tako-console<br/>Next.js :3000"]
        Server["tako-server<br/>REST :8080<br/>gRPC :50051"]
        DB[("SQLite WAL")]
        LocalAgent["tako-agent"]
        LocalDocker["Docker Engine"]
        LocalRoutes["/etc/tako/traefik/dynamic"]
        LocalApps["Workload containers"]
    end

    subgraph Worker["Worker node"]
        WorkerEdge["Traefik"]
        WorkerAgent["tako-agent"]
        WorkerDocker["Docker Engine"]
        WorkerRoutes["/etc/tako/traefik/dynamic"]
        WorkerApps["Workload containers"]
    end

    Browser -->|"HTTPS"| Edge
    Edge -->|"console"| Console
    Edge -->|"deployed apps"| LocalApps
    Console -->|"/api/v1 proxy"| Server
    Server <--> DB
    Server <-->|"outbound gRPC"| LocalAgent
    Server <-->|"outbound gRPC"| WorkerAgent
    LocalAgent --> LocalDocker
    LocalAgent --> LocalRoutes
    LocalDocker --> LocalApps
    Edge -.->|"watches"| LocalRoutes
    WorkerAgent --> WorkerDocker
    WorkerAgent --> WorkerRoutes
    WorkerDocker --> WorkerApps
    WorkerEdge -.->|"watches"| WorkerRoutes
    WorkerEdge -->|"deployed apps"| WorkerApps
```

The master stores state in SQLite and talks to agents over gRPC. Agents never
accept inbound management connections; they dial out to the master, execute
Docker and Traefik work locally, and stream logs and task results back.

## Deployment flow

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant Console as Next.js Console
    participant Server as tako-server
    participant DB as SQLite
    participant Agent as tako-agent
    participant Docker as Docker Engine
    participant Traefik as Traefik

    Operator->>Console: Deploy service
    Console->>Server: POST /api/v1/services/{id}/deploy
    Server->>DB: Insert deployment (queued)
    Server->>Agent: DeployRequest over StreamTasks
    Agent->>Agent: Clone or pull repository
    Agent->>Docker: Build or pull image
    Agent->>Traefik: Write preview route
    Agent->>Docker: Start new container
    Agent->>Docker: Health check
    alt Health check passes
        Agent->>Traefik: Write canonical route
        Agent->>Docker: Prune old previews
        Agent->>Server: Report Live
    else Health check fails
        Agent->>Server: Report Failed
        Server->>Agent: Roll back to last healthy deployment
    end
    Agent-->>Server: Task result and log chunks
    Server-->>Console: SSE events and logs
    Console-->>Operator: Live progress
```

## Repository layout

```text
gettako/
├── console/      Next.js 16 operator console (App Router, React 19)
├── server/       Master control plane (Go, Chi, SQLite, gRPC)
├── agent/        Worker daemon (Go, Docker Engine SDK, outbound gRPC)
├── api/          Protobuf contracts and generated Go stubs
├── deploy/       Docker Compose stacks and Traefik configuration
├── install.sh    Master and worker installer
└── go.work       Go workspace: server, agent, and proto modules
```

## Local development

```bash
# Master server
cd server
TAKO_AGENT_SECRET=dev-token TAKO_DB_PATH=../data/tako.db go run ./cmd/server

# Worker agent
cd agent
TAKO_MASTER_URL=127.0.0.1:50051 TAKO_ENROLL_TOKEN=dev-token \
TAKO_NODE_NAME=tako-local TAKO_STATE_FILE=../data/agent.json \
go run ./cmd/agent

# Console
cd console
bun install
bun run dev
```

The console proxies `/api/v1/*` to `TAKO_SERVER_URL` (default
`http://127.0.0.1:8080`), so the browser talks to the same origin in development
and production.

## Verification

```bash
go build ./server/... ./agent/...
(cd server && go test ./...)
(cd agent && go test ./...)
(cd console && bun run lint && bun run typecheck && bun run build)
```
