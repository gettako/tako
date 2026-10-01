# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-beta.2] - 2026-10-01

### Security
- **Auth & Authorization**:
  - Enforce `RequireAdmin` middleware across cluster settings (`/api/settings/console-domain`), S3 storage management (`/api/storage/s3`), database backups (`/api/settings/backup`), notification webhooks (`/api/settings/notifications`), and GitHub App connections (`/api/github/connections`), preventing members from modifying cluster-wide configuration or downloading database snapshots.
  - Add WebSocket `Origin` header validation to the web terminal handler to prevent Cross-Site WebSocket Hijacking (CSWSH) from untrusted origins and preview domains.
  - Encrypt two-factor authentication (TOTP) secrets at rest with AES-256-GCM using the master key; hash recovery codes with SHA-256 before storage and verify using constant-time comparison to prevent timing attacks and plaintext exposure.
- **Secrets & Environment**:
  - Mask sensitive environment variable values (`is_secret: true`) in API list responses (`GET /api/services/{id}/env`) to prevent exposing plaintext secrets to authenticated members.
  - Upgrade master key derivation from single-round SHA-256 to HKDF-SHA256 and introduce a versioned ciphertext envelope (`v1:nonce:ct`) for authenticated AES-256-GCM encryption with forward-compatible key rotation.
- **Network & Infrastructure**:
  - Enforce mutual TLS (mTLS) with server certificates on the gRPC listener between the control plane coordinator and worker node agents.
  - Remove broad host port bindings (`0.0.0.0`) from the default Docker Compose configuration, restricting console (port 3000) and API server (port 8080) to loopback (`127.0.0.1`) to prevent exposing internal services on host interfaces.
  - Block custom domain attachment to the control plane console domain (`h.domain`) to prevent tenant services from hijacking control plane traffic routing via Traefik.
- **Node Enrollment**:
  - Hash worker node enrollment secrets with SHA-256 prior to persisting in the database, authenticate using constant-time comparison, and enforce rate limiting on the enrollment endpoint to mitigate token enumeration and brute-force probing.
- **Backup & Storage**:
  - Reject automated Redis restore operations at the agent layer with an actionable error message directing administrators to manual procedures, disable the Redis restore action in the console web UI, and document streaming RDB and live-tar consistency requirements.
  - Block host-path bind mounts (such as `/` or `/var/run/docker.sock`) in user Compose configurations, restricting volume mounts to named volumes to prevent host filesystem takeover and container escape vulnerabilities.
- **CI/Pipeline**:
  - Skip automated deployment and preview build pipelines for pull requests originating from external forks to prevent exfiltration of repository secrets and environment variables.
- **Installer**:
  - Resolve worker node agent installer script routing issues, sanitize example control plane IP addresses to RFC 5737 testnet addresses (`203.0.113.10`) in `deploy/install-agent.sh`, and add test coverage validating all installation script URLs.

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

[Unreleased]: https://github.com/gettako/tako/compare/v0.1.0-beta.2...HEAD
[0.1.0-beta.2]: https://github.com/gettako/tako/compare/v0.1.0-beta.1...v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/gettako/tako/releases/tag/v0.1.0-beta.1
