<p align="center">
  <a href="https://gettako.dev">
    <img src="docs/images/tako.png" width="100" alt="Tako Logo" />
  </a>
</p>

<h1 align="center">Tako</h1>

<p align="center">
  <b>Self-hosted platform for deploying modern web applications across your own servers.</b><br />
  Simple, git-driven container deployments with zero cloud lock-in.
</p>

<p align="center">
  <a href="https://gettako.dev">Official Website</a> •
  <a href="https://gettako.dev/docs">Documentation</a> •
  <a href="#quickstart">Quickstart</a> •
  <a href="#architecture">Architecture</a> •
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <a href="https://github.com/gettako/tako">
    <img src="https://img.shields.io/badge/status-active%20development-orange?style=for-the-badge" alt="Status: Active Development" />
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

> [!WARNING]
> **Active Heavy Development**: Tako is under rapid, continuous development and is currently in early preview. Features, database schemas, and configuration structures may change abruptly, and bugs are to be expected. It is not yet recommended for mission-critical production workloads.

---

## Overview

**Tako** is an open-source, self-hosted deployment platform that turns standard Linux servers into a private application PaaS. Connect your GitHub repositories, define your services using standard Dockerfiles or Compose configurations, and manage deployments across multiple servers from a single control plane.

Tako is designed for solo developers, founders, and small teams who want:

- **Infrastructure ownership**: Run your workloads on any cloud provider (Hetzner, DigitalOcean, AWS) or bare-metal server.
- **Git-driven workflow**: Automated container builds and deployments triggered directly on `git push`.
- **Zero-downtime cutover**: Health check validation gates traffic routing before older containers are stopped.
- **Multi-server orchestration**: Manage remote worker nodes from one control plane without exposing inbound management ports.
- **Collaborative access**: Shared workspace with role-based permissions (`admin` and `member`) and token invite links.
- **Transparent tooling**: Standard Docker Engine and Traefik v3 under the hood—no hidden buildpack abstractions.

Visit [gettako.dev](https://gettako.dev) for official guides, documentation, and release notes.

---

## Features

- **Multi-Server Orchestration**: Attach and orchestrate remote worker nodes across different providers from a single centralized dashboard.
- **Outbound-Only gRPC Streams**: Worker nodes initiate outbound TLS connections to the control plane. Remote servers require no open inbound SSH or agent ports.
- **Standard Docker Tooling**: Transparent builds directly from source using standard `Dockerfile` or `docker-compose.yml` configurations.
- **Zero-Downtime Deployments**: Automated HTTP health checking gates traffic switchover in Traefik before older containers are gracefully retired.
- **Instant Rollbacks**: Revert to previous successful image tags in seconds using local Docker image retention without rebuilding from source.
- **Automatic SSL & Ingress**: Integrated Traefik reverse proxy automatically provisions and renews Let's Encrypt certificates for custom domains.
- **Team Collaboration**: Invite colleagues to a shared workspace with `admin` and `member` roles via secure token links (no SMTP setup required).
- **Real-Time Logs & Web Terminal**: Live build output and container stdout/stderr stream directly to the browser via Server-Sent Events (SSE), alongside interactive in-browser container terminals.
- **Encrypted Secrets**: Runtime environment variables and build secrets are stored encrypted at rest with AES-256-GCM in embedded SQLite.
- **Managed Database Templates**: One-click provisioning for PostgreSQL, MySQL, and Redis services with persistent Docker volumes.
- **Scheduled S3 Backups**: Automated database dumps and volume backups to any S3-compatible storage bucket.
- **Pull Request Previews**: Ephemeral preview environments with automatic wildcard routing for GitHub pull requests.

---

## Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Control Plane** | [Go](https://go.dev/) 1.24+ | REST API, SSE event broker, gRPC coordinator |
| **Web Dashboard** | [Next.js](https://nextjs.org/) 16 & [React](https://react.dev/) 19 | Border-driven UI with Base UI, Tailwind CSS 4, Bun |
| **Worker Agent** | [Go](https://go.dev/) | Docker Engine SDK, Traefik provider, outbound gRPC client |
| **Reverse Proxy** | [Traefik](https://traefik.io/) v3 | Dynamic container routing, Let's Encrypt automated TLS |
| **Database** | [SQLite](https://sqlite.org/) | Embedded pure-Go engine with WAL mode and AES-256-GCM encryption |
| **API Contracts** | OpenAPI 3.1 & gRPC | Type-safe API contracts and streaming protocols |

---

## Architecture

### System Topology

```
Tako Architecture
├── Control Plane (Primary Server)
│   ├── Next.js 16 Console (Port 3000 / Web UI)
│   ├── Go API & Orchestrator (Port 8080 / REST + SSE)
│   ├── gRPC Coordinator (Port 50051 / TLS)
│   └── SQLite DB (Encrypted at rest with AES-256-GCM)
│
└── Worker Nodes (Remote Servers)
    ├── Tako Node Agent (Outbound gRPC client to Control Plane)
    ├── Traefik v3 (Reverse proxy & Let's Encrypt SSL on Ports 80 & 443)
    └── Docker Containers (Isolated application runtime)
```

Remote worker nodes connect **outbound** to the control plane over a single persistent gRPC stream. This design eliminates the need to expose SSH or agent management ports to the public internet on worker nodes.

### Entity Hierarchy

```
Control Plane
└── Project (e.g., "analytics")
    └── Service (e.g., "api", "web", "worker")
        ├── Deployments (Git triggers, build history, instant rollback)
        ├── Domains (Custom domains, automatic Let's Encrypt SSL)
        ├── Environment (Encrypted variables, build args)
        ├── Monitoring (Container health status, runtime logs, stats)
        └── Terminal (Interactive browser shell)
```

---

## Quickstart

### System Requirements

- **Operating System**: Linux (Ubuntu 22.04+, Debian 12+, Rocky Linux 9+, or Alpine Linux)
- **Architecture**: `x86_64` (AMD64) or `aarch64` (ARM64)
- **RAM**: Minimum 1 GB (2 GB+ recommended for concurrent builds)
- **Disk**: 10 GB+ available SSD storage
- **Docker**: Docker Engine 24.0+ and Docker Compose v2

### Production Installation

Install the Tako control plane on your primary server with the official install script:

```bash
curl -fsSL https://gettako.dev/install.sh | bash
```

The script will:
1. Verify system dependencies (Docker, Docker Compose, network ports).
2. Generate secure random credentials and an AES-256-GCM encryption key.
3. Start the Tako control plane stack (`server`, `console`, and `traefik`) via Docker Compose.
4. Output the initial one-time administrator onboarding URL.

For detailed installation guides, see the [Documentation](https://gettako.dev/docs).

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

**3. Start the web dashboard:**

```bash
bun run --filter console dev
```

**4. Start the Go control plane server:**

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
├── docs/                 # Documentation source (https://gettako.dev/docs)
├── internal/             # Shared Go packages (protocol, models, crypto)
├── api/                  # API contracts (openapi.yaml, protobuf definitions)
├── deploy/               # Production Docker Compose definitions and install script
├── tests/                # Integration and end-to-end test suites
├── go.mod                # Root Go module
└── package.json          # Root Bun workspace configuration
```

---

## Design Principles & Boundaries

Tako is built with clear architectural boundaries to maintain simplicity and reliability:

- **Single Flat Workspace**: Designed for solo operators and small teams with straightforward `admin` and `member` roles. Multi-tenant organizational hierarchies and custom permission matrices are intentional non-goals.
- **Dockerfile & Compose Workflows**: Builds rely on standard Dockerfiles and Compose configurations. Proprietary buildpacks (such as Cloud Native Buildpacks or Nixpacks) are not used, keeping builds predictable and reproducible locally.
- **Native Docker Engine**: Works directly with the local Docker daemon on Linux hosts. No Kubernetes or Docker Swarm overlay networks required.
- **Embedded SQLite Persistence**: The control plane uses pure-Go SQLite in WAL mode with AES-256-GCM encryption. No standalone relational database service is required to operate the control plane.
- **Linux Host Requirement**: Production deployments require Linux with access to `/var/run/docker.sock`.

---

## Security

- Worker nodes connect exclusively via outbound TLS-encrypted gRPC streams.
- Application secrets and environment variables are encrypted at rest with AES-256-GCM.
- Sensitive values are redacted from build logs and system audit logs.

**Reporting Vulnerabilities:** If you discover a security issue, please follow our responsible disclosure process outlined in [SECURITY.md](SECURITY.md) or email **security@gettako.dev**. Please do not open public issues for security vulnerabilities.

---

## Contributing

Contributions, bug reports, and feedback are welcome! Please check out [CONTRIBUTING.md](CONTRIBUTING.md) for code style guidelines, development workflows, and PR expectations.

---

## License

Tako is licensed under the [Apache License 2.0](LICENSE).
