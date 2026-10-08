# Milestone 09: Mintlify Documentation & OpenAPI Specification

---
- **ID**: `M09`
- **Status**: `completed`
- **Blocking**: `[M01, M08]`
- **Target**: Build modern technical documentation in the `docs/` folder using Mintlify. Provide `*.mdx` structure, color themes aligned with the Tako Design System, comprehensive installation and architecture guides, and an OpenAPI specification (`openapi.yaml` / `openapi.json`) covering all Master Server REST API endpoints.
---

## Acceptance Criteria
- [x] `docs/` folder structured according to Mintlify standards with `docs.json` (and `mint.json`).
- [x] Color scheme adopts the Tako Design System (Primary `#432DD7`, Dark `#5B63D3`).
- [x] Complete installation guides available for Master Server and Worker Nodes using the `install.sh` script.
- [x] Detailed architecture explanations provided: Console (Next.js), Master Server (Go + Chi + SQLite WAL), Agent (Docker SDK + gRPC), and Traefik proxy.
- [x] `docs/openapi.yaml` (OpenAPI 3.1) file covers all REST API endpoints: Auth, Projects, Services, Deployments, Nodes, and Audit Logs.
- [x] API Reference pages in Mintlify link with `openapi.yaml` and render interactively.

## Checklist
- [x] **Mintlify Base Setup (`docs/`)**:
  - [x] Create navigation configuration file with:
    - *Getting Started* (Introduction, Quickstart)
    - *Installation* (Main Server, Node Server, Manual Docker)
    - *Architecture* (Overview, gRPC Communication, Traefik Routing, Security & BFF)
    - *User Guides* (Projects & Services, Deployments & Rollbacks, Monitoring & Logs)
    - *API Reference* (OpenAPI interactive docs)
  - [x] Create logo and favicon SVG assets in `docs/logo/` and `docs/favicon.svg`
- [x] **Core MDX Guides (`docs/*.mdx`)**:
  - [x] `docs/introduction.mdx`: Tako PaaS overview, key features, architecture comparison
  - [x] `docs/quickstart.mdx`: 5-minute setup guide for master server and first application deployment
  - [x] `docs/installation/main-server.mdx`: Master server setup guide with `https://gettako.dev/install.sh | bash`, interactive prompts, environment variables
  - [x] `docs/installation/node-server.mdx`: Worker node setup guide with `install.sh --agent`, enrollment tokens, and network topology
  - [x] `docs/architecture/overview.mdx`: Master-agent gRPC & Docker architecture diagram
  - [x] `docs/architecture/grpc-communication.mdx`: gRPC streaming protocol, heartbeat payloads, task streaming, and log streaming
  - [x] `docs/architecture/traefik-routing.mdx`: Traefik v3 reverse proxy integration, dynamic file provider, and Let's Encrypt automated TLS
  - [x] `docs/guides/services-deployments.mdx`: Service configurations, custom domains, container lifecycles, and deployments
  - [x] `docs/guides/monitoring-logs.mdx`: Node telemetry, container log streaming, and historical audits
- [x] **OpenAPI Specification (`docs/openapi.yaml`)**:
  - [x] Define `info`, `servers`, and `securitySchemes` (Bearer JWT / Session Cookie)
  - [x] Define endpoint schemas:
    - `/api/v1/health` & `/api/v1/ping`
    - `/api/v1/auth/login`, `/api/v1/auth/logout`, `/api/v1/auth/me`
    - `/api/v1/nodes`, `/api/v1/nodes/enroll-token`, `/api/v1/nodes/{id}`
    - `/api/v1/projects`, `/api/v1/projects/{id}`
    - `/api/v1/services`, `/api/v1/services/{id}`, `/api/v1/services/{id}/deploy`, `/api/v1/services/{id}/deployments`
    - `/api/v1/deployments`, `/api/v1/deployments/{id}`, `/api/v1/deployments/{id}/logs`, `/api/v1/deployments/{id}/logs/history`
    - `/api/v1/events/nodes` (Server-Sent Events)
  - [x] Validate `openapi.yaml` syntax (schema error-free)
- [x] **Local Preview Verification**:
  - [x] Validate Mintlify navigation syntax and OpenAPI references
