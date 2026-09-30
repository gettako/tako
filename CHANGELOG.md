# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-beta.1] - 2026-10-01

### Added
- **Multi-Server Control Plane & Agent Orchestration**:
  - Centralized Go control plane coordinator with REST API and outbound-only gRPC streams over TLS.
  - Remote worker agent daemon connecting outbound to control plane—no open inbound SSH or management ports required on worker nodes.
  - Server enrollment workflow with one-time cryptographically secure tokens.
- **Git-Driven Deployments & Container Tooling**:
  - Automatic builds triggered by GitHub webhook push events and manual deployment triggers.
  - Standard `Dockerfile` and `docker-compose.yml` stack parsing and container lifecycle management.
  - Ephemeral build sandboxing: git clone executed to temporary build directories and immediately unlinked after container image creation.
  - Zero-downtime cutover gated by configurable HTTP health check probes before old containers are gracefully stopped.
  - Image retention policy on worker nodes enabling one-click instant rollbacks to prior releases without rebuilding.
- **Ingress & Automatic SSL**:
  - Integrated Traefik v3 reverse proxy per node with dynamic file provider.
  - Automated Let's Encrypt TLS certificate provisioning and renewal for custom domains and subdomains.
- **Web Console Dashboard**:
  - Built with Next.js 16, React 19, Tailwind CSS 4, and Base UI (`@base-ui/react`).
  - Real-time build progress and container stdout/stderr streaming via Server-Sent Events (SSE).
  - Browser-based interactive container terminal (web shell) powered by `@xterm/xterm`.
  - Comprehensive service management: environment variables, custom domains, monitoring metrics, deployment histories, and auxiliary services.
- **Team Collaboration & Access Control**:
  - Shared flat workspace supporting multiple operators.
  - Role-Based Access Control (RBAC) with `admin` and `member` roles.
  - Invitation link system with single-use cryptographic tokens (zero SMTP requirement).
  - Tamper-evident system audit log with monotonic ULID identifiers and actor attribution.
- **Storage & Managed Databases**:
  - Database service templates for PostgreSQL, MySQL, and Redis with persistent Docker volumes.
  - Automated streaming database dumps and volume backups to S3-compatible object storage destinations.
- **Security & Persistence**:
  - Embedded pure-Go SQLite with Write-Ahead Logging (WAL) mode.
  - AES-256-GCM encryption at rest for runtime environment variables, tokens, and build secrets.
  - Sensitive value redaction across build logs and system audit logs.

[Unreleased]: https://github.com/gettako/tako/compare/v0.1.0-beta.1...HEAD
[0.1.0-beta.1]: https://github.com/gettako/tako/releases/tag/v0.1.0-beta.1
