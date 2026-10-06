# Milestone 09: Mintlify Documentation & OpenAPI Specification

---
- **ID**: `M09`
- **Status**: `todo`
- **Blocking**: `[M01, M08]`
- **Target**: Membangun dokumentasi teknis modern di folder `docs/` menggunakan Mintlify. Menyediakan struktur `*.mdx`, tema warna yang selaras dengan Tako Design System, panduan instalasi/arsitektur lengkap, dan spesifikasi OpenAPI (`openapi.yaml` / `openapi.json`) untuk seluruh endpoint REST API Master Server.
---

## Acceptance Criteria
- [ ] Folder `docs/` terstruktur sesuai standar Mintlify dengan konfigurasi `mint.json`.
- [ ] Skema warna `mint.json` mengadopsi Tako Design System (Light `#432DD7`, Dark `#5B63D3`).
- [ ] Tersedia panduan instalasi lengkap untuk Main Server dan Node Worker menggunakan script `install.sh`.
- [ ] Tersedia penjelasan arsitektur detail: Console (Next.js), Master Server (Go + Chi + SQLite WAL), Agent (Docker SDK + gRPC), dan Traefik proxy.
- [ ] File `docs/openapi.yaml` (OpenAPI 3.1) mencakup seluruh endpoint REST API: Auth, Projects, Services, Deployments, Nodes, dan Audit Logs.
- [ ] Halaman API Reference di Mintlify terhubung dengan `openapi.yaml` dan dapat di-render secara interaktif.

## Checklist
- [ ] **Mintlify Base Setup (`docs/`)**:
  - [ ] Buat file konfigurasi `docs/mint.json` dengan navigasi:
    - *Getting Started* (Introduction, Quickstart)
    - *Installation* (Main Server, Node Server, Manual Docker)
    - *Architecture* (Overview, gRPC Communication, Traefik Routing, Security & BFF)
    - *User Guides* (Projects & Services, Deployments & Rollbacks, Monitoring & Logs)
    - *API Reference* (OpenAPI interactive docs)
  - [ ] Buat aset logo/favicon atau placeholder SVG di `docs/assets/`
- [ ] **Core MDX Guides (`docs/*.mdx`)**:
  - [ ] `docs/introduction.mdx`: Overview Tako PaaS, fitur utama, perbandingan dengan platform lain
  - [ ] `docs/quickstart.mdx`: Panduan 5 menit setup main server dan deploy aplikasi pertama
  - [ ] `docs/installation/main-server.mdx`: Panduan instalasi `https://gettako.dev/install.sh | bash`, input interaktif, env variables
  - [ ] `docs/installation/node-server.mdx`: Panduan instalasi `install.sh --agent`, enrollment token, networking
  - [ ] `docs/architecture/overview.mdx`: Diagram arsitektur master-agent gRPC & Docker compose
- [ ] **OpenAPI Specification (`docs/openapi.yaml`)**:
  - [ ] Definisikan `info`, `servers`, dan `securitySchemes` (Bearer JWT / Session Cookie)
  - [ ] Definisikan skema endpoints:
    - `/api/v1/health` & `/api/v1/ping`
    - `/api/v1/auth/login`, `/api/v1/auth/logout`, `/api/v1/auth/me`
    - `/api/v1/nodes`, `/api/v1/nodes/enroll-token`, `/api/v1/nodes/{id}`
    - `/api/v1/projects`, `/api/v1/projects/{id}`
    - `/api/v1/services`, `/api/v1/services/{id}`, `/api/v1/services/{id}/deploy`
    - `/api/v1/deployments/{id}`, `/api/v1/deployments/{id}/logs`
    - `/api/v1/events/nodes` (Server-Sent Events)
  - [ ] Validasi sintaks `openapi.yaml` (bebas error schema)
- [ ] **Local Preview Verification**:
  - [ ] Verifikasi kompatibilitas dengan CLI `npx mintlify dev`
