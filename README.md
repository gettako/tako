<p align="center">
  <img src="docs/images/tako.png" width="100" alt="Tako Logo" />
</p>

<h1 align="center">Tako: Community Edition</h1>
<p align="center"><i>Simple. Lightweight. Yours. Self-hosted platform for auto-deploying applications, no cloud lock-in.</i></p>
<p align="center"><a href="https://gettako.dev">gettako.dev</a></p>

<p align="center">
  <a href="https://github.com/gettako/tako/releases">
    <img src="https://img.shields.io/github/v/release/gettako/tako?style=for-the-badge&logo=github&label=Release" alt="Release" />
  </a>
  <a href="https://github.com/gettako/tako/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/gettako/tako/ci.yml?style=for-the-badge&logo=github&label=CI" alt="CI" />
  </a>
  <a href="https://github.com/gettako/tako/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-Apache--2.0-blue?style=for-the-badge" alt="License" />
  </a>
  <a href="https://go.dev">
    <img src="https://img.shields.io/badge/Go-1.24%2B-00ADD8?style=for-the-badge&logo=go" alt="Go" />
  </a>
  <a href="https://nextjs.org">
    <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  </a>
  <a href="https://www.docker.com">
    <img src="https://img.shields.io/badge/Docker-24%2B-2496ED?style=for-the-badge&logo=docker" alt="Docker" />
  </a>
</p>

---

## About Tako

Tako is a self-hosted platform for automatically deploying modern web applications (Laravel, Go, Node.js, Python, Rust, and more) to one or more virtual private servers (VPS). It is designed as a lightweight, personal alternative to tools like Dokploy and Coolify, with deliberately fewer features and zero bloat.

Tako is built for solo developers, founders, and small teams who want:

- Full ownership of their hosting infrastructure.
- Zero-downtime automated deployments from GitHub on git push.
- Automatic SSL termination via Let's Encrypt and Traefik.
- Transparent container and live build log streaming.
- Simple, reliable multi-server management without Kubernetes complexity.

Tako is strictly for **single-user personal use** (one owner/admin account per installation). However, it natively supports managing **multiple remote servers** from a single control plane dashboard.

> [!NOTE]
> **Single-Operator Architecture.** Tako is intentionally built for a single administrator. Multi-tenancy, team permissions, and third-party app stores are explicit non-goals to keep the platform lightweight, secure, and rock-solid.

---

## Key Features

- **Multi-Server Management**: Orchestrate multiple remote worker nodes from a single central control plane dashboard.
- **Outbound-Only gRPC Streams**: Node agents connect outbound to the control plane over TLS streams, requiring zero open inbound management ports on remote servers.
- **Dockerfile-Driven Builds**: Predictable and transparent container builds directly from git repositories, avoiding heavy buildpack abstractions.
- **Zero-Downtime Deployments**: Automated HTTP health checking gates traffic cutover before older containers are gracefully drained and stopped.
- **Instant Rollback**: Local Docker image retention enables rollback to prior successful releases in seconds without rebuilding.
- **Automatic SSL & Ingress**: Dedicated Traefik reverse proxy on each node provisions and renews Let's Encrypt wildcard and custom domain certificates automatically.
- **Encrypted Secrets**: Runtime environment variables and build secrets are encrypted at rest in SQLite using AES-256-GCM.
- **Real-Time Log Streaming**: Live build logs and container runtime outputs stream directly to your browser over Server-Sent Events (SSE).
- **Precision Flat UI**: Clean dashboard engineered with Next.js 16, Base UI (`base-vega`), Tailwind CSS 4, and zero shadows.
- **Resource-Efficient Architecture**: Written in pure Go with SQLite (WAL mode) and Next.js, requiring minimal host resources.

---

## Tech Stack

- **Control Plane**: [Go](https://go.dev/) 1.24+ (REST API, SSE streaming, gRPC coordinator)
- **Web Dashboard**: [Next.js](https://nextjs.org/) 16, [React](https://react.dev/) 19, [Tailwind CSS](https://tailwindcss.com/) 4, [Bun](https://bun.sh/)
- **UI & Design System**: [Base UI](https://base-ui.com/) (`@base-ui/react`) with shadcn/ui `base-vega` (zero shadows, border-driven hierarchy)
- **Node Agent**: [Go](https://go.dev/) (Docker Engine SDK, Traefik dynamic provider, outbound gRPC client)
- **Reverse Proxy**: [Traefik](https://traefik.io/) v3 (automated Let's Encrypt SSL, dynamic container routing)
- **Database**: Pure-Go [SQLite](https://sqlite.org/) with WAL mode and AES-256-GCM encryption
- **API Specifications**: OpenAPI 3.1 & Protocol Buffers (gRPC)

---

## Architecture & Data Hierarchy

### System Topology

```
Tako Architecture
├── Control Plane (Primary Server)
│   ├── Next.js 16 Dashboard (Port 3000 / Web UI)
│   ├── Go API & Orchestrator (Port 8080 / REST + SSE)
│   ├── gRPC Server (Port 50051 / TLS)
│   └── SQLite DB (Encrypted at rest with AES-256-GCM)
│
└── Worker Nodes (Remote Servers)
    ├── Tako Node Agent (Outbound gRPC client to Control Plane)
    ├── Traefik v3 (Reverse proxy & Let's Encrypt SSL on Ports 80 & 443)
    └── Docker Containers (Isolated application runtime)
```

### Entity Hierarchy

```
Dashboard
└── Project (e.g., "acme-corp")
    └── Service (e.g., "api", "web")
        ├── Overview (Status, primary URL, metrics)
        ├── Deployments (History, live build logs, rollback)
        ├── Domains (Routing, Let's Encrypt SSL, ports)
        ├── Monitoring (Container health, runtime logs, stats)
        └── Environment (Encrypted variables, build arguments)
```

---

## Quickstart

### System Requirements

- **Operating System**: Linux (Ubuntu 22.04+, Debian 12+, Rocky Linux 9+, or Alpine Linux)
- **Architecture**: `x86_64` (AMD64) or `aarch64` (ARM64)
- **RAM**: Minimum 1 GB (2 GB+ recommended for builds)
- **Disk**: 10 GB+ available SSD storage
- **Docker**: Docker Engine 24.0+ and Docker Compose v2

### Production Installation

Run the official installation script on your primary server:

```bash
curl -fsSL https://gettako.dev/install.sh | bash
```

The script performs the following setup:

1. Validates system dependencies (Docker, Compose, network ports).
2. Generates secure random credentials and an encryption key for secrets (`AES-256-GCM`).
3. Starts the Tako control plane stack (`server`, `web`, and `traefik`) via Docker Compose.
4. Outputs the initial one-time administrator onboarding URL.

### Local Development

**1. Clone the repository:**

```bash
git clone https://github.com/gettako/tako.git
cd tako
```

**2. Install dependencies:**

```bash
bun install
```

**3. Run the console dashboard:**

```bash
bun run --filter console dev
```

**4. Run the Go control plane server:**

```bash
go run ./server
```

---

## Repository Structure

```
tako/
├── console/              # Next.js 16 dashboard (Base UI, Tailwind CSS 4, Bun)
├── server/               # Go control plane (REST API, SSE, SQLite DB, orchestrator)
├── agent/                # Go worker node daemon (Docker SDK, Traefik, gRPC client)
├── docs/                 # Mintlify documentation (public user guides + API reference)
├── internal/             # Shared Go packages (protocol, models, crypto)
├── api/                  # Contract definitions (openapi.yaml, protobuf)
├── assets/               # Branding graphics and sponsor assets
├── deploy/               # Production Docker Compose definitions and install script
├── plans/                # Architecture specs and roadmap task breakdown
├── AGENTS.md             # Working protocols for AI coding agents
├── go.mod                # Root Go module
├── package.json          # Root Bun workspace configuration
└── README.md             # Project documentation
```

---

## Security & Privacy

Tako enforces end-to-end security across all deployments. Remote agents communicate exclusively over outbound TLS gRPC channels with no open inbound ports required on worker nodes. All application secrets and environment variables are encrypted at rest with AES-256-GCM.

**Reporting a Vulnerability:** If you discover a security issue, please follow the responsible disclosure process described in [SECURITY.md](SECURITY.md). Do not open a public GitHub issue for security vulnerabilities: contact **security@gettako.dev** directly.

---

## Contributing

Contributions are welcome: bug reports, feature discussions, and pull requests alike. If you are new to the codebase, check out issues labeled `good first issue` as a starting point.

Before submitting a pull request, please read [CONTRIBUTING.md](CONTRIBUTING.md). It covers architecture constraints, code style, commit conventions, branch workflows, and PR review expectations.

---

## License

Tako is licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) for the full license text.
