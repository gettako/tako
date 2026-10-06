# Milestone 09: Mintlify Documentation & OpenAPI Specification

---
- **ID**: `M09`
- **Status**: `completed`
- **Blocking**: `[M01, M08]`
- **Target**: Membangun dokumentasi teknis modern di folder `docs/` menggunakan Mintlify. Menyediakan struktur `*.mdx`, tema warna yang selaras dengan Tako Design System, panduan instalasi/arsitektur lengkap, dan spesifikasi OpenAPI (`openapi.yaml` / `openapi.json`) untuk seluruh endpoint REST API Master Server.
---

## Acceptance Criteria
- [x] Folder `docs/` terstruktur sesuai standar Mintlify dengan konfigurasi `mint.json`.
- [x] Skema warna `mint.json` mengadopsi Tako Design System (Light `#432DD7`, Dark `#5B63D3`).
- [x] Tersedia panduan instalasi lengkap untuk Main Server dan Node Worker menggunakan script `install.sh`.
- [x] Tersedia penjelasan arsitektur detail: Console (Next.js), Master Server (Go + Chi + SQLite WAL), Agent (Docker SDK + gRPC), dan Traefik proxy.
- [x] File `docs/openapi.yaml` (OpenAPI 3.1) mencakup seluruh endpoint REST API: Auth, Projects, Services, Deployments, Nodes, dan Audit Logs.
- [x] Halaman API Reference di Mintlify terhubung dengan `openapi.yaml` dan dapat di-render secara interaktif.

## Checklist
- [x] **Mintlify Base Setup (`docs/`)**:
  - [x] Buat file konfigurasi `docs/mint.json` dengan navigasi:
    - *Getting Started* (Introduction, Quickstart)
    - *Installation* (Main Server, Node Server, Manual Docker)
    - *Architecture* (Overview, gRPC Communication, Traefik Routing, Security & BFF)
    - *User Guides* (Projects & Services, Deployments & Rollbacks, Monitoring & Logs)
    - *API Reference* (OpenAPI interactive docs)
  - [x] Buat aset logo/favicon SVG di `docs/logo/` dan `docs/favicon.svg`
- [x] **Core MDX Guides (`docs/*.mdx`)**:
  - [x] `docs/introduction.mdx`: Overview Tako PaaS, fitur utama, perbandingan dengan platform lain
  - [x] `docs/quickstart.mdx`: Panduan 5 menit setup main server dan deploy aplikasi pertama
  - [x] `docs/installation/main-server.mdx`: Panduan instalasi `https://gettako.dev/install.sh | bash`, input interaktif, env variables
  - [x] `docs/installation/node-server.mdx`: Panduan instalasi `install.sh --agent`, enrollment token, networking
  - [x] `docs/architecture/overview.mdx`: Diagram arsitektur master-agent gRPC & Docker compose
  - [x] `docs/architecture/grpc-communication.mdx`: Protokol gRPC, payload heartbeat, dan log streaming
  - [x] `docs/architecture/traefik-routing.mdx`: Integrasi Traefik reverse proxy & auto-TLS Let's Encrypt
  - [x] `docs/guides/services-deployments.mdx`: Konfigurasi service, domain, dan deployment
  - [x] `docs/guides/monitoring-logs.mdx`: Telemetri node, container logs, dan live stream
- [x] **OpenAPI Specification (`docs/openapi.yaml`)**:
  - [x] Definisikan `info`, `servers`, dan `securitySchemes` (Bearer JWT / Session Cookie)
  - [x] Definisikan skema endpoints:
    - `/api/v1/health` & `/api/v1/ping`
    - `/api/v1/auth/login`, `/api/v1/auth/logout`, `/api/v1/auth/me`
    - `/api/v1/nodes`, `/api/v1/nodes/enroll-token`, `/api/v1/nodes/{id}`
    - `/api/v1/projects`, `/api/v1/projects/{id}`
    - `/api/v1/services`, `/api/v1/services/{id}`, `/api/v1/services/{id}/deploy`, `/api/v1/services/{id}/deployments`
    - `/api/v1/deployments`, `/api/v1/deployments/{id}`, `/api/v1/deployments/{id}/logs`, `/api/v1/deployments/{id}/logs/history`
    - `/api/v1/events/nodes` (Server-Sent Events)
  - [x] Validasi sintaks `openapi.yaml` (bebas error schema)
- [x] **Local Preview Verification**:
  - [x] Validasi sintaks `mint.json` dan `openapi.yaml`
